CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE barbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
  display_name VARCHAR(120) NOT NULL CHECK (char_length(trim(display_name)) BETWEEN 2 AND 120),
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE weekly_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barber_id UUID NOT NULL REFERENCES barbers(id) ON DELETE RESTRICT,
  weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  CHECK (start_time < end_time),
  EXCLUDE USING gist (
    barber_id WITH =,
    weekday WITH =,
    tsrange(date '2000-01-01' + start_time, date '2000-01-01' + end_time, '[)') WITH &&
  )
);

CREATE INDEX weekly_hours_barber_weekday_idx ON weekly_hours (barber_id, weekday);

CREATE TABLE time_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barber_id UUID NOT NULL REFERENCES barbers(id) ON DELETE RESTRICT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  reason VARCHAR(200) NOT NULL CHECK (char_length(trim(reason)) BETWEEN 1 AND 200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at),
  EXCLUDE USING gist (
    barber_id WITH =,
    tstzrange(starts_at, ends_at, '[)') WITH &&
  )
);

CREATE INDEX time_blocks_barber_starts_idx ON time_blocks (barber_id, starts_at);