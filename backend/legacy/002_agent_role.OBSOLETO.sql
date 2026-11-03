-- Migración aditiva: rol Agente (PostgreSQL). No altera estructuras del Admin.
BEGIN;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin','agent','user'));

CREATE TABLE event_agents (
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  assigned_by UUID NOT NULL REFERENCES users(id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  PRIMARY KEY (event_id, agent_id)
);
CREATE INDEX idx_event_agents_active ON event_agents (agent_id) WHERE revoked_at IS NULL;

CREATE FUNCTION trg_event_agents_role() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.agent_id AND role = 'agent') THEN
    RAISE EXCEPTION 'El usuario % no tiene rol agent', NEW.agent_id;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER event_agents_role_chk BEFORE INSERT OR UPDATE ON event_agents
  FOR EACH ROW EXECUTE FUNCTION trg_event_agents_role();

ALTER TABLE events
  ADD COLUMN availability TEXT NOT NULL DEFAULT 'open' CHECK (availability IN ('open','paused','closed')),
  ADD COLUMN is_public BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN is_featured BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE attendees
  ADD COLUMN checked_in_at TIMESTAMPTZ,
  ADD COLUMN checked_in_by UUID REFERENCES users(id),
  ADD CONSTRAINT chk_checkin_confirmed CHECK (checked_in_at IS NULL OR status = 'confirmado');
CREATE INDEX idx_attendees_event_status ON attendees (event_id, status);

CREATE TABLE event_audit_log (
  id BIGSERIAL PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES events(id),
  actor_id UUID NOT NULL REFERENCES users(id),
  action TEXT NOT NULL, old_value JSONB, new_value JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- El Agente solo consulta esta vista (sin budget, spent ni coordinator)
CREATE VIEW events_operational AS
  SELECT id, name, type, date, time, location, capacity, status, availability, description, image FROM events;
COMMIT;
