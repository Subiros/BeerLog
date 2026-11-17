CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  invite_code text UNIQUE NOT NULL
    DEFAULT substr(md5(random()::text), 1, 8),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.beers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid()
    REFERENCES public.profiles(id) ON DELETE CASCADE,
  brand text NOT NULL,
  type text NOT NULL,
  abv numeric(4,1) NOT NULL DEFAULT 0,
  ml int NOT NULL,
  price numeric(6,2) NOT NULL DEFAULT 0,
  place text,
  with_whom text,
  photo_path text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS beers_user_created_idx
ON public.beers (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.friendships (
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  friend_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, friend_id)
);

-- 2. FUNCIÓ: CREAR PERFIL AUTOMÀTIC

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (
    NEW.id,
    split_part(NEW.email, '@', 1) || '_' ||
    substr(md5(random()::text), 1, 3)
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- 3. TRIGGER D'AUTENTICACIÓ

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- 4. SEGURETAT RLS

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

-- Profiles

DROP POLICY IF EXISTS "ver perfiles" ON public.profiles;
CREATE POLICY "ver perfiles"
ON public.profiles
FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "editar mi perfil" ON public.profiles;
CREATE POLICY "editar mi perfil"
ON public.profiles
FOR UPDATE TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Beers

DROP POLICY IF EXISTS "ver mis cervezas y las de amigos" ON public.beers;
CREATE POLICY "ver mis cervezas y las de amigos"
ON public.beers
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.friendships f
    WHERE f.user_id = auth.uid()
      AND f.friend_id = beers.user_id
  )
);

DROP POLICY IF EXISTS "crear mis cervezas" ON public.beers;
CREATE POLICY "crear mis cervezas"
ON public.beers
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "borrar mis cervezas" ON public.beers;
CREATE POLICY "borrar mis cervezas"
ON public.beers
FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- Friendships

DROP POLICY IF EXISTS "ver mis amistades" ON public.friendships;
CREATE POLICY "ver mis amistades"
ON public.friendships
FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- 5. AFEGIR AMIC PER CODI

CREATE OR REPLACE FUNCTION public.add_friend_by_code(code text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  fid uuid;
BEGIN
  SELECT id INTO fid
  FROM public.profiles
  WHERE invite_code = lower(trim(code));

  IF fid IS NULL THEN
    RETURN 'Código no válido';
  END IF;

  IF fid = auth.uid() THEN
    RETURN 'Ese eres tú';
  END IF;

  INSERT INTO public.friendships (user_id, friend_id)
  VALUES (auth.uid(), fid), (fid, auth.uid())
  ON CONFLICT DO NOTHING;

  RETURN 'ok';
END;
$$;

-- 6. RÀNQUING D'AMICS

CREATE OR REPLACE FUNCTION public.friend_ranking()
RETURNS TABLE (
  username text,
  beers bigint,
  alcohol_ml numeric,
  spent numeric
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.username,
    count(b.id),
    coalesce(sum(b.ml * b.abv / 100), 0),
    coalesce(sum(b.price), 0)
  FROM public.profiles p
  LEFT JOIN public.beers b ON b.user_id = p.id
  WHERE
    p.id = auth.uid()
    OR p.id IN (
      SELECT friend_id
      FROM public.friendships
      WHERE user_id = auth.uid()
    )
  GROUP BY p.username
  ORDER BY 3 DESC;
$$;

-- 7. BUCKET DE FOTOS

INSERT INTO storage.buckets (id, name, public)
VALUES ('beer-photos', 'beer-photos', false)
ON CONFLICT (id) DO NOTHING;

-- 8. POLÍTIQUES DE FOTOS

DROP POLICY IF EXISTS "subir mis fotos" ON storage.objects;
CREATE POLICY "subir mis fotos"
ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'beer-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "ver mis fotos" ON storage.objects;
CREATE POLICY "ver mis fotos"
ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'beer-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
