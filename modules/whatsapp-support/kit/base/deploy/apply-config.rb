# Kit whatsapp-support: aplica a marca do projeto e o painel no Chatwoot (InstallationConfig).
# Roda com rails runner dentro do contêiner do Chatwoot, uma vez a cada implantação, pelo caminho de
# implantação do projeto (no compose de modelo: o serviço chatwoot-config). Lê só variáveis KIT_* e o
# arquivo gerado por "kit.mjs theme"; não imprime valor nenhum, só o nome de cada chave gravada.
#
# Na imagem -ce não existe o serviço que devolve a marca do Chatwoot no plano comunitário
# (enterprise/app/services/internal/reconcile_plan_config_service.rb), por isso o que se grava aqui fica.

def kit_set(name, value)
  config = InstallationConfig.find_or_initialize_by(name: name)
  return puts("igual #{name}") if config.persisted? && config.value == value

  config.value = value
  config.save!
  puts "gravado #{name}"
end

def kit_env(name)
  value = ENV.fetch(name, '').to_s.strip
  value.empty? ? nil : value
end

brand = kit_env('KIT_BRAND_NAME')
if brand
  kit_set('INSTALLATION_NAME', brand)
  kit_set('BRAND_NAME', brand)
end

{
  'LOGO' => 'KIT_LOGO_URL',
  'LOGO_DARK' => 'KIT_LOGO_DARK_URL',
  'LOGO_THUMBNAIL' => 'KIT_LOGO_THUMBNAIL_URL',
  'BRAND_URL' => 'KIT_BRAND_URL',
  'WIDGET_BRAND_URL' => 'KIT_BRAND_URL',
  'TERMS_URL' => 'KIT_TERMS_URL',
  'PRIVACY_URL' => 'KIT_PRIVACY_URL',
  'LOGOUT_REDIRECT_LINK' => 'KIT_LOGOUT_URL'
}.each do |key, env|
  value = kit_env(env)
  kit_set(key, value) if value
end

# Valores booleanos de verdade: o layout testa DISPLAY_MANIFEST como booleano do Ruby.
kit_set('DISPLAY_MANIFEST', false)
kit_set('DISABLE_USER_PROFILE_UPDATE', true)
kit_set('ENABLE_ACCOUNT_SIGNUP', false)

scripts_file = kit_env('KIT_DASHBOARD_SCRIPTS_FILE') || '/kit/gerado/painel.html'
if File.exist?(scripts_file)
  kit_set('DASHBOARD_SCRIPTS', File.read(scripts_file))
else
  puts "sem arquivo de tema em #{scripts_file}; rode kit.mjs theme antes"
end

GlobalConfig.clear_cache
puts 'configuração do kit aplicada'
