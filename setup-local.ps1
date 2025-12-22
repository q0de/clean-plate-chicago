# CleanPlate Chicago - Local Setup Script
Write-Host "Setting up CleanPlate Chicago for local development..." -ForegroundColor Green

# Check if .env.local exists
if (-not (Test-Path ".env.local")) {
    Write-Host "Creating .env.local from template..." -ForegroundColor Yellow
    Copy-Item "env.local.example" ".env.local"
    Write-Host "✓ Created .env.local - Please fill in your credentials!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Required environment variables:" -ForegroundColor Cyan
    Write-Host "  - NEXT_PUBLIC_SUPABASE_URL" -ForegroundColor White
    Write-Host "  - NEXT_PUBLIC_SUPABASE_ANON_KEY" -ForegroundColor White
    Write-Host "  - SUPABASE_SERVICE_ROLE_KEY" -ForegroundColor White
    Write-Host "  - NEXT_PUBLIC_MAPBOX_TOKEN" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host "✓ .env.local already exists" -ForegroundColor Green
}

# Check if node_modules exists
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing dependencies..." -ForegroundColor Yellow
    npm install
    Write-Host "✓ Dependencies installed" -ForegroundColor Green
} else {
    Write-Host "✓ Dependencies already installed" -ForegroundColor Green
}

Write-Host ""
Write-Host "Setup complete! Next steps:" -ForegroundColor Green
Write-Host "1. Edit .env.local with your Supabase and Mapbox credentials" -ForegroundColor White
Write-Host "2. Set up your Supabase database (see SETUP.md)" -ForegroundColor White
Write-Host "3. Run 'npm run dev' to start the development server" -ForegroundColor White
Write-Host ""







