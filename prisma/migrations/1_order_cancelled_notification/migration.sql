-- AlterEnum: add order_cancelled to NotificationType (service-order cancel notify)
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'order_cancelled';
