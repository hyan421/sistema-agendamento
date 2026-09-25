CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(80) NOT NULL CHECK (char_length(trim(name)) BETWEEN 3 AND 80),
  description VARCHAR(500) NOT NULL DEFAULT '' CHECK (char_length(description) <= 500),
  category VARCHAR(10) NOT NULL CHECK (category IN ('CUT', 'BEARD', 'COMBO')),
  duration_minutes SMALLINT NOT NULL CHECK (duration_minutes BETWEEN 15 AND 180 AND duration_minutes % 15 = 0),
  price_cents INTEGER NOT NULL CHECK (price_cents BETWEEN 1 AND 100000),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX services_active_category_price_idx
  ON services (category, price_cents)
  WHERE active = TRUE;