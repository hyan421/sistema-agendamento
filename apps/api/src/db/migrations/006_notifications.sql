CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE RESTRICT,
  kind VARCHAR(24) NOT NULL CHECK (kind IN ('BOOKING_CONFIRMED', 'BOOKING_CANCELLED', 'BOOKING_REMINDER')),
  message VARCHAR(500) NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, appointment_id, kind)
);

CREATE INDEX notifications_user_created_idx ON notifications (user_id, created_at DESC, id);