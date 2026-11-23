/* Supabase 접속 정보 (프론트용, 공개돼도 되는 값만)
   - SUPABASE_URL: Project Settings → API → Project URL
   - SUPABASE_ANON_KEY: Project Settings → API Keys → anon(public) 또는 Publishable key
   service_role / secret 키는 절대 넣지 않습니다. 데이터 보호는 로그인 + DB 권한(RLS)이 합니다. */
window.DFIND_CONFIG = {
  SUPABASE_URL: 'https://rbuwhpfukidmluasbpsj.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_FduqqN-7m2aQB2iP2ujzqA_aHtoMuvl'
};
