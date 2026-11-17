-- Ejecuta esto en Supabase > SQL Editor (sirve tanto si ya ejecutaste schema.sql como si no)

-- 1) Usuario y contraseña: el nombre de usuario viaja en los metadatos del registro
create or replace function handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, username)
  values (new.id, coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)));
  return new;
end $$;

-- Comprobar si un usuario está libre antes de registrarse
create or replace function username_available(name text) returns boolean language sql security definer set search_path = public as $$
  select not exists (select 1 from profiles where username = lower(trim(name)));
$$;
grant execute on function username_available(text) to anon, authenticated;

-- 2) Feed: tus cervezas y las de tus amigos, de más reciente a menos
create or replace function feed(lim int default 50) returns table (
  id uuid, user_id uuid, username text, brand text, type text, abv numeric, ml int,
  price numeric, place text, with_whom text, photo_path text, created_at timestamptz)
language sql security definer set search_path = public as $$
  select b.id, b.user_id, p.username, b.brand, b.type, b.abv, b.ml, b.price, b.place, b.with_whom, b.photo_path, b.created_at
  from beers b join profiles p on p.id = b.user_id
  where b.user_id = auth.uid() or b.user_id in (select friend_id from friendships where user_id = auth.uid())
  order by b.created_at desc limit lim;
$$;

-- 3) Los amigos pueden ver las fotos de tu carpeta
create policy "ver fotos de amigos" on storage.objects for select to authenticated
  using (bucket_id = 'beer-photos' and exists (
    select 1 from friendships f
    where f.user_id = auth.uid() and f.friend_id::text = (storage.foldername(name))[1]));
