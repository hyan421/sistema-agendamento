CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  CREATE TYPE user_role AS ENUM ('CLIENT', 'BARBER', 'ADMIN');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL CHECK (char_length(trim(name)) BETWEEN 2 AND 120),
  email VARCHAR(320) NOT NULL,
  password_hash TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'CLIENT',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX users_email_lower_unique ON users (lower(email));

CREATE TABLE shop (
  id SMALLINT PRIMARY KEY CHECK (id = 1),
  name VARCHAR(120) NOT NULL,
  city VARCHAR(100) NOT NULL,
  district VARCHAR(100) NOT NULL,
  address VARCHAR(240) NOT NULL,
  timezone VARCHAR(64) NOT NULL
);
