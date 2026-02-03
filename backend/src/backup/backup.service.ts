import { Injectable, BadRequestException } from '@nestjs/common';
import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Cron } from '@nestjs/schedule';

const BACKUP_RETENTION_DAYS = 7;
const ONEDRIVE_FOLDER = 'Backups/tg-app';
const DUMP_TIMEOUT_MS = 120_000;
const RESTORE_TIMEOUT_MS = 300_000;

@Injectable()
export class BackupService {
  private get destination(): 'local' | 'onedrive' | null {
    const v = process.env.BACKUP_DESTINATION;
    if (v === 'local' || v === 'onedrive') return v;
    return null;
  }

  private get localPath(): string | null {
    const p = process.env.BACKUP_LOCAL_PATH;
    return p && p.trim() ? p.trim() : null;
  }

  private get useDocker(): boolean {
    return process.env.BACKUP_USE_DOCKER !== 'false';
  }

  private get dbHost(): string {
    return process.env.DB_HOST ?? 'localhost';
  }

  private get dbPort(): string {
    return process.env.DB_PORT ?? '5432';
  }

  private get dbUser(): string {
    return process.env.DB_USER ?? 'tgapp';
  }

  private get dbPassword(): string {
    return process.env.DB_PASSWORD ?? 'tgapp_secret';
  }

  private get dbName(): string {
    return process.env.DB_NAME ?? 'tgapp';
  }

  async runDump(): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      if (this.useDocker) {
        const proc = spawn('docker', [
          'exec',
          'tg-app-postgres',
          'pg_dump',
          '-U',
          this.dbUser,
          this.dbName,
        ], { stdio: ['ignore', 'pipe', 'pipe'] });
        const chunks: Buffer[] = [];
        const stderrChunks: Buffer[] = [];
        proc.stdout?.on('data', (chunk: Buffer) => chunks.push(chunk));
        proc.stderr?.on('data', (chunk: Buffer) => stderrChunks.push(chunk));
        proc.on('error', (err) => reject(err));
        const timeoutId = setTimeout(() => {
          proc.kill('SIGKILL');
          reject(new Error('pg_dump timeout'));
        }, DUMP_TIMEOUT_MS);
        proc.on('close', (code) => {
          clearTimeout(timeoutId);
          if (code !== 0) {
            const stderrText = Buffer.concat(stderrChunks).toString('utf8').trim();
            reject(new Error(stderrText ? `pg_dump exited with code ${code}: ${stderrText}` : `pg_dump exited with code ${code}`));
          } else {
            resolve(Buffer.concat(chunks));
          }
        });
      } else {
        const env = { ...process.env, PGPASSWORD: this.dbPassword };
        const proc = spawn(
          'pg_dump',
          ['-h', this.dbHost, '-p', this.dbPort, '-U', this.dbUser, '-d', this.dbName],
          { env, stdio: ['ignore', 'pipe', 'pipe'] },
        );
        const chunks: Buffer[] = [];
        const stderrChunks: Buffer[] = [];
        proc.stdout?.on('data', (chunk: Buffer) => chunks.push(chunk));
        proc.stderr?.on('data', (chunk: Buffer) => stderrChunks.push(chunk));
        proc.on('error', (err) => reject(err));
        const timeoutId = setTimeout(() => {
          proc.kill('SIGKILL');
          reject(new Error('pg_dump timeout'));
        }, DUMP_TIMEOUT_MS);
        proc.on('close', (code) => {
          clearTimeout(timeoutId);
          if (code !== 0) {
            const stderrText = Buffer.concat(stderrChunks).toString('utf8').trim();
            reject(new Error(stderrText ? `pg_dump exited with code ${code}: ${stderrText}` : `pg_dump exited with code ${code}`));
          } else {
            resolve(Buffer.concat(chunks));
          }
        });
      }
    });
  }

  private getFilename(emergency = false): string {
    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    const time = now.toTimeString().slice(0, 5).replace(':', '-');
    return emergency ? `tgapp_${date}_${time}.sql` : `tgapp_${date}.sql`;
  }

  private async saveToLocal(buffer: Buffer, filename: string): Promise<string> {
    const dir = this.localPath!;
    await fs.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, filename);
    await fs.writeFile(filePath, buffer);
    return filePath;
  }

  private async getOneDriveAccessToken(): Promise<string> {
    const clientId = process.env.ONEDRIVE_CLIENT_ID;
    const clientSecret = process.env.ONEDRIVE_CLIENT_SECRET;
    const refreshToken = process.env.ONEDRIVE_REFRESH_TOKEN;
    if (!clientId || !clientSecret || !refreshToken) {
      throw new BadRequestException('OneDrive credentials not configured');
    }
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });
    const res = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new BadRequestException(`OneDrive token refresh failed: ${text}`);
    }
    const data = (await res.json()) as { access_token?: string };
    if (!data.access_token) throw new BadRequestException('No access_token in response');
    return data.access_token;
  }

  private async saveToOneDrive(buffer: Buffer, filename: string): Promise<void> {
    const token = await this.getOneDriveAccessToken();
    const url = `https://graph.microsoft.com/v1.0/me/drive/root:/${ONEDRIVE_FOLDER}/${encodeURIComponent(filename)}:/content`;
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/octet-stream',
      },
      body: new Uint8Array(buffer),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new BadRequestException(`OneDrive upload failed: ${text}`);
    }
  }

  private parseDateFromFilename(name: string): Date | null {
    const match = name.match(/tgapp_(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return null;
    const [, y, m, d] = match;
    const date = new Date(parseInt(y!, 10), parseInt(m!, 10) - 1, parseInt(d!, 10));
    return isNaN(date.getTime()) ? null : date;
  }

  private async deleteOldLocal(): Promise<void> {
    const dir = this.localPath!;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - BACKUP_RETENTION_DAYS);
    let entries: string[];
    try {
      entries = await fs.readdir(dir);
    } catch {
      return;
    }
    for (const name of entries) {
      const date = this.parseDateFromFilename(name);
      if (date && date < cutoff) {
        try {
          await fs.unlink(path.join(dir, name));
        } catch {
          // ignore
        }
      }
    }
  }

  private async deleteOldOneDrive(): Promise<void> {
    const token = await this.getOneDriveAccessToken();
    const listUrl = `https://graph.microsoft.com/v1.0/me/drive/root:/${ONEDRIVE_FOLDER}:/children`;
    const res = await fetch(listUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const data = (await res.json()) as { value?: Array<{ id: string; name: string; lastModifiedDateTime?: string }> };
    const items = data.value ?? [];
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - BACKUP_RETENTION_DAYS);
    for (const item of items) {
      const date = this.parseDateFromFilename(item.name) ?? (item.lastModifiedDateTime ? new Date(item.lastModifiedDateTime) : null);
      if (date && date < cutoff) {
        await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${item.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    }
  }

  async runScheduledBackup(): Promise<void> {
    if (!this.destination) return;
    const buffer = await this.runDump();
    const filename = this.getFilename(false);
    if (this.destination === 'local' && this.localPath) {
      await this.saveToLocal(buffer, filename);
      await this.deleteOldLocal();
    } else if (this.destination === 'onedrive') {
      await this.saveToOneDrive(buffer, filename);
      await this.deleteOldOneDrive();
    }
  }

  @Cron('0 0 * * *', { timeZone: process.env.BACKUP_TZ ?? undefined })
  async handleCron(): Promise<void> {
    try {
      await this.runScheduledBackup();
    } catch (err) {
      console.error('Scheduled backup failed:', err);
    }
  }

  async runEmergencyBackup(): Promise<{ filename: string; size: number }> {
    if (!this.destination) {
      throw new BadRequestException('Backup not configured: set BACKUP_DESTINATION and required env');
    }
    const buffer = await this.runDump();
    const filename = this.getFilename(true);
    if (this.destination === 'local' && this.localPath) {
      await this.saveToLocal(buffer, filename);
      await this.deleteOldLocal();
    } else if (this.destination === 'onedrive') {
      await this.saveToOneDrive(buffer, filename);
      await this.deleteOldOneDrive();
    }
    return { filename, size: buffer.length };
  }

  async restoreFromFile(filePath: string): Promise<void> {
    const sql = await fs.readFile(filePath, 'utf8');
    return new Promise((resolve, reject) => {
      if (this.useDocker) {
        const proc = spawn('docker', ['exec', '-i', 'tg-app-postgres', 'psql', '-U', this.dbUser, '-d', this.dbName], {
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        const stderrChunks: Buffer[] = [];
        proc.stdout?.on('data', () => {});
        proc.stderr?.on('data', (chunk: Buffer) => stderrChunks.push(chunk));
        proc.stdin?.write(sql, (err) => {
          if (err) reject(err);
          else proc.stdin?.end();
        });
        proc.on('error', reject);
        const timeoutId = setTimeout(() => {
          proc.kill('SIGKILL');
          reject(new Error('Restore timeout'));
        }, RESTORE_TIMEOUT_MS);
        proc.on('close', (code) => {
          clearTimeout(timeoutId);
          if (code !== 0) {
            const stderrText = Buffer.concat(stderrChunks).toString('utf8').trim();
            reject(new Error(stderrText ? `psql exited with code ${code}: ${stderrText}` : `psql exited with code ${code}`));
          } else {
            resolve();
          }
        });
      } else {
        const env = { ...process.env, PGPASSWORD: this.dbPassword };
        const proc = spawn(
          'psql',
          ['-h', this.dbHost, '-p', this.dbPort, '-U', this.dbUser, '-d', this.dbName, '-f', filePath],
          { env },
        );
        const stderrChunks: Buffer[] = [];
        proc.stdout?.on('data', () => {});
        proc.stderr?.on('data', (chunk: Buffer) => stderrChunks.push(chunk));
        proc.on('error', reject);
        const timeoutId = setTimeout(() => {
          proc.kill('SIGKILL');
          reject(new Error('Restore timeout'));
        }, RESTORE_TIMEOUT_MS);
        proc.on('close', (code) => {
          clearTimeout(timeoutId);
          if (code !== 0) {
            const stderrText = Buffer.concat(stderrChunks).toString('utf8').trim();
            reject(new Error(stderrText ? `psql exited with code ${code}: ${stderrText}` : `psql exited with code ${code}`));
          } else {
            resolve();
          }
        });
      }
    });
  }

  isBackupConfigured(): boolean {
    if (!this.destination) return false;
    if (this.destination === 'local') return !!this.localPath;
    if (this.destination === 'onedrive') {
      return !!(
        process.env.ONEDRIVE_CLIENT_ID &&
        process.env.ONEDRIVE_CLIENT_SECRET &&
        process.env.ONEDRIVE_REFRESH_TOKEN
      );
    }
    return false;
  }
}
