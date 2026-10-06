-- Expand-only: Layantara's reservations arrive from Expedia and Trip.com as
-- well as Airbnb/Booking.com/Agoda. Without their own values they collapse
-- into 'agent', losing the channel for commission and channel-mix reporting.
ALTER TYPE "BookingChannel" ADD VALUE IF NOT EXISTS 'expedia';
ALTER TYPE "BookingChannel" ADD VALUE IF NOT EXISTS 'trip_com';
