-- Pega esto entero en Supabase > SQL Editor > Run

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  username text unique not null,
  invite_code text unique not null default substr(md5(random()::text), 1, 8),
  created_at timestamptz default now()
);

create table beers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references profiles(id) on delete cascade,
  brand text not null,
  type text not null,
  abv numeric(4,1) not null default 0,
  ml int not null,
  price numeric(6,2) not null default 0,
  place text,
  with_whom text,
  photo_path text,
  created_at timestamptz default now()
);
create index on beers (user_id, created_at desc);

create table friendships (
  user_id uuid references profiles(id) on delete cascade,
  friend_id uuid references profiles(id) on delete cascade,
  primary key (user_id, friend_id)
);

-- Perfil automático al registrarse
create function handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, username)
  values (new.id, split_part(new.email, '@', 1) || '_' || substr(md5(random()::text), 1, 3));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- Seguridad (RLS)
alter table profiles enable row level security;
alter table beers enable row level security;
alter table friendships enable row level security;

create policy "ver perfiles" on profiles for select to authenticated using (true);
create policy "editar mi perfil" on profiles for update to authenticated using (id = auth.uid());

create policy "ver mis cervezas y las de amigos" on beers for select to authenticated
  using (user_id = auth.uid() or exists (
    select 1 from friendships f where f.user_id = auth.uid() and f.friend_id = beers.user_id));
create policy "crear mis cervezas" on beers for insert to authenticated with check (user_id = auth.uid());
create policy "borrar mis cervezas" on beers for delete to authenticated using (user_id = auth.uid());

create policy "ver mis amistades" on friendships for select to authenticated using (user_id = auth.uid());

-- Añadir amigo con su código (crea la amistad en ambos sentidos)
create function add_friend_by_code(code text) returns text language plpgsql security definer set search_path = public as $$
declare fid uuid;
begin
  select id into fid from profiles where invite_code = lower(trim(code));
  if fid is null then return 'Código no válido'; end if;
  if fid = auth.uid() then return 'Ese eres tú'; end if;
  insert into friendships values (auth.uid(), fid), (fid, auth.uid()) on conflict do nothing;
  return 'ok';
end $$;

-- Ranking entre amigos (incluyéndote)
create function friend_ranking() returns table (username text, beers bigint, alcohol_ml numeric, spent numeric)
language sql security definer set search_path = public as $$
  select p.username, count(b.id), coalesce(sum(b.ml * b.abv / 100), 0), coalesce(sum(b.price), 0)
  from profiles p left join beers b on b.user_id = p.id
  where p.id = auth.uid() or p.id in (select friend_id from friendships where user_id = auth.uid())
  group by p.username order by 3 desc;
$$;

-- Fotos: bucket privado, cada usuario solo en su carpeta
insert into storage.buckets (id, name, public) values ('beer-photos', 'beer-photos', false);
create policy "subir mis fotos" on storage.objects for insert to authenticated
  with check (bucket_id = 'beer-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "ver mis fotos" on storage.objects for select to authenticated
  using (bucket_id = 'beer-photos' and (storage.foldername(name))[1] = auth.uid()::text);
