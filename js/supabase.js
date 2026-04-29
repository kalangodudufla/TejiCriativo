const SUPABASE_URL = 'https://hxdzkfypnmzrsdfnicwo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4ZHprZnlwbm16cnNkZm5pY3dvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0MTMxMTcsImV4cCI6MjA5Mjk4OTExN30.P6EsRvrTEKgJQvc97fn3EtPdv7iCi8TRHPnXdC0wbSk';

const { createClient } = supabase
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

window.supabase = supabaseClient;
