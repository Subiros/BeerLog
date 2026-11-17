# Birreal

## Puesta en marcha
1. Crea un proyecto gratis en supabase.com.
2. SQL Editor: pega y ejecuta `supabase/schema.sql`.
3. Authentication > URL Configuration: pon `http://localhost:3000` (y luego tu URL de Vercel) como Site URL.
4. Copia `.env.example` a `.env.local` con la URL y la anon key (Project Settings > API).
5. `npm install` y `npm run dev` -> http://localhost:3000
6. Publicar: sube el repo a GitHub, impórtalo en vercel.com y añade las dos variables de entorno.
