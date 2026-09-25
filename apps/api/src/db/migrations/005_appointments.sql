CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  barber_id UUID NOT NULL REFERENCES barbers(id) ON DELETE RESTRICT,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  status VARCHAR(12) NOT NULL DEFAULT 'CONFIRMED'
    CHECK (status IN ('CONFIRMED', 'CANCELLED', 'COMPLETED')),
  service_name_snapshot VARCHAR(80) NOT NULL,
  price_cents_snapshot INTEGER NOT NULL CHECK (price_cents_snapshot BETWEEN 1 AND 100000),
  duration_minutes_snapshot SMALLINT NOT NULL
    CHECK (duration_minutes_snapshot BETWEEN 15 AND 180 AND duration_minutes_snapshot % 15 = 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  cancelled_at TIMESTAMPTZ,
  cancelled_by UUID REFERENCES users(id) ON DELETE RESTRICT,
  CHECK (ends_at > starts_at),
  CHECK (
    (status = 'CANCELLED' AND cancelled_at IS NOT NULL AND cancelled_by IS NOT NULL) OR
    (status <> 'CANCELLED' AND cancelled_at IS NULL AND cancelled_by IS NULL)
  ),
  EXCLUDE USING gist (
    barber_id WITH =,
    tstzrange(starts_at, ends_at, '[)') WITH &&
  ) WHERE (status IN ('CONFIRMED', 'COMPLETED'))
);

CREATE INDEX appointments_client_starts_idx ON appointments (client_id, starts_at, id);
CREATE INDEX appointments_barber_starts_idx ON appointments (barber_id, starts_at, id);
CREATE INDEX appointments_service_starts_idx ON appointments (service_id, starts_at);