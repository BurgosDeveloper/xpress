-- CreateTable
CREATE TABLE `PasswordResetRequest` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `role` ENUM('USER', 'DRIVER', 'ADMIN') NOT NULL,
    `phoneRaw` VARCHAR(191) NOT NULL,
    `phoneLast3` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `sentAt` DATETIME(3) NULL,
    `verifiedAt` DATETIME(3) NULL,
    `consumedAt` DATETIME(3) NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PasswordResetRequest_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `PasswordResetRequest_expiresAt_consumedAt_idx`(`expiresAt`, `consumedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `PasswordResetRequest` ADD CONSTRAINT `PasswordResetRequest_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
