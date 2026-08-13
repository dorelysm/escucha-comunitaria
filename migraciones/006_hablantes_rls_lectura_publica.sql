create policy "lectura publica de hablantes"
  on hablantes for select
  to anon, authenticated
  using (true);
