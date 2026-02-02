import {
  Controller,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MasterOrAdminGuard } from '../auth/guards/master-or-admin.guard';
import { BackupService } from './backup.service';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import * as multer from 'multer';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

@Controller('backup')
@UseGuards(JwtAuthGuard, MasterOrAdminGuard)
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  @Post('run')
  async runEmergencyBackup(): Promise<{ filename: string; size: number }> {
    if (!this.backupService.isBackupConfigured()) {
      throw new BadRequestException('Backup is not configured. Set BACKUP_DESTINATION and required env.');
    }
    return this.backupService.runEmergencyBackup();
  }

  @Post('restore')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: multer.memoryStorage(),
      limits: { fileSize: MAX_FILE_SIZE },
    }),
  )
  async restore(
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<{ message: string }> {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    const buffer = (file as Express.Multer.File & { buffer?: Buffer }).buffer;
    if (!buffer) {
      throw new BadRequestException('File buffer not available');
    }
    const name = file.originalname?.toLowerCase() ?? '';
    if (!name.endsWith('.sql')) {
      throw new BadRequestException('Only .sql files are allowed');
    }
    const tmpDir = os.tmpdir();
    const tmpPath = path.join(tmpDir, `restore_${Date.now()}.sql`);
    try {
      await fs.writeFile(tmpPath, buffer);
      await this.backupService.restoreFromFile(tmpPath);
      return { message: 'Database restored successfully' };
    } finally {
      await fs.unlink(tmpPath).catch(() => {});
    }
  }
}
