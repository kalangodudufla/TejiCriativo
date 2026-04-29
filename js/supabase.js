const SUPABASE_URL = 'https://hxdzkfypnmzrsdfnicwo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4ZHprZnlwbm16cnNkZm5pY3dvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0MTMxMTcsImV4cCI6MjA5Mjk4OTExN30.P6EsRvrTEKgJQvc97fn3EtPdv7iCi8TRHPnXdC0wbSk';
 
// FIX CRÍTICO: O CDN do Supabase expõe o factory como window.supabase (objeto global).
// Se nomearmos nossa variável também de "supabase", ela sobrescreve o factory ANTES
// de criarmos o client, causando o erro "Cannot read properties of undefined".
// Solução: usar o namespace correto window.supabase para criar e guardar em "db".
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);