-- The app: what each trial is called, which agent works it, and when Scorcher's agent last ran it (for the daily cap).
ALTER TABLE trials ADD COLUMN title TEXT;
ALTER TABLE trials ADD COLUMN agent TEXT;
ALTER TABLE trials ADD COLUMN ran_at INTEGER;
