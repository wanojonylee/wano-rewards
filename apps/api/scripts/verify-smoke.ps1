# Live smoke test against a running API (default http://localhost:8787/api/v1).
# Usage: powershell -ExecutionPolicy Bypass -File scripts/verify-smoke.ps1
$ErrorActionPreference = "Stop"
$base = "http://localhost:8787/api/v1"
$json = "application/json"

function PostJson($url, $body, $headers = @{}) {
  $h = @{ "Content-Type" = $json } + $headers
  return Invoke-RestMethod -Method Post -Uri $url -Headers $h -Body ($body | ConvertTo-Json -Depth 6 -Compress)
}

Write-Host "== health ==" -ForegroundColor Cyan
Invoke-RestMethod "$base/health" | ConvertTo-Json -Compress

Write-Host "`n== auth: request OTP + verify ==" -ForegroundColor Cyan
PostJson "$base/auth/request-otp" @{ identifier = "+5511999990000"; channel = "sms" } | ConvertTo-Json -Compress
$auth = PostJson "$base/auth/verify" @{ identifier = "+5511999990000"; code = "123456"; locale = "pt-BR" }
$h = @{ Authorization = "Bearer $($auth.accessToken)" }
@{ isNewUser = $auth.isNewUser; user = $auth.user.name; accessToken = $auth.accessToken.Substring(0, 24) + "..." } | ConvertTo-Json -Compress

Write-Host "`n== GET /me ==" -ForegroundColor Cyan
$me = Invoke-RestMethod "$base/me" -Headers $h
@{ user = $me.user.name; wallet = $me.wallet; tier = @{ code = $me.tier.code; name = $me.tier.name; multiplier = $me.tier.multiplier; pointsToNext = $me.tier.pointsToNext }; stats = $me.stats; rank = $me.rank } | ConvertTo-Json -Depth 6 -Compress

Write-Host "`n== GET /home ==" -ForegroundColor Cyan
$homeData = Invoke-RestMethod "$base/home" -Headers $h
@{ greetingName = $homeData.greetingName; wallet = $homeData.wallet; tier = $homeData.tier.code; weeklyGoal = $homeData.weeklyGoal; nearbyMachine = @{ code = $homeData.nearbyMachine.code; status = $homeData.nearbyMachine.status; distanceMeters = $homeData.nearbyMachine.distanceMeters; fillPercent = $homeData.nearbyMachine.fillPercent }; campaigns = $homeData.campaigns.Count; recentEntries = $homeData.recent.Count; rank = $homeData.rank.condo } | ConvertTo-Json -Depth 6 -Compress
$homeData.campaigns | Select-Object -First 3 | ForEach-Object { "  campaign: {0} | {1}x | +{2} pts | joined={3} | progress={4}/{5} {6}" -f $_.title, $_.multiplier, $_.bonusPoints, $_.joined, $_.progress.current, $_.progress.target, $_.progress.unit }

Write-Host "`n== session: start + 3 simulated deposits + complete ==" -ForegroundColor Cyan
$session = PostJson "$base/sessions/start" @{ machineCode = "RVM-SP-001"; source = "qr" } $h
$sid = $session.session.id
@{ sessionId = $sid; status = $session.session.status; startedAt = $session.session.startedAt; expiresAt = $session.session.expiresAt; pollAfterMs = $session.pollAfterMs; machine = $session.session.machine.name } | ConvertTo-Json -Compress
foreach ($material in @("PET", "ALUMINUM", "GLASS")) {
  $dep = PostJson "$base/sessions/$sid/simulate-deposit" @{ material = $material } $h
  "  deposit: {0} {1}g -> +{2} pts, cashback {3}c, co2 {4}g | session totals: {5} items / {6} pts" -f $dep.deposit.skuName, $dep.deposit.weightGrams, $dep.deposit.points, $dep.deposit.cashbackCents, $dep.deposit.co2Grams, $dep.totals.items, $dep.totals.points
}
$completed = PostJson "$base/sessions/$sid/complete" @{} $h
@{ status = $completed.session.status; totals = $completed.session.totals; receipt = $completed.session.receipt.code } | ConvertTo-Json -Depth 4 -Compress

Write-Host "`n== rewards: list + redeem (idempotent) ==" -ForegroundColor Cyan
$rewards = Invoke-RestMethod "$base/rewards?category=voucher&limit=6" -Headers $h
"  vouchers: " + (($rewards.items | ForEach-Object { "$($_.title) ($($_.pointsCost) pts)" }) -join " | ")
$idem = [guid]::NewGuid().ToString()
$redeemBody = @{ quantity = 1 }
$redeem1 = PostJson "$base/rewards/rwd_icecream/redeem" $redeemBody ($h + @{ "Idempotency-Key" = $idem })
$redeem2 = PostJson "$base/rewards/rwd_icecream/redeem" $redeemBody ($h + @{ "Idempotency-Key" = $idem })
@{ code = $redeem1.redemption.code; qrPayload = $redeem1.redemption.qrPayload; status = $redeem1.redemption.status; pointsSpent = $redeem1.redemption.pointsSpent; walletPoints = $redeem1.wallet.points; replay = @{ code = $redeem2.redemption.code; replayed = $redeem2.replayed; walletPoints = $redeem2.wallet.points } } | ConvertTo-Json -Depth 4 -Compress

Write-Host "`n== leaderboard (condo) ==" -ForegroundColor Cyan
$board = Invoke-RestMethod "$base/leaderboard?scope=condo" -Headers $h
@{ scope = $board.scope; period = $board.period.label; me = $board.me } | ConvertTo-Json -Depth 4 -Compress
$board.rows | Select-Object -First 5 | ForEach-Object { "  #{0} {1} — {2} {3}{4}" -f $_.position, $_.displayName, $_.value, $_.unit, $(if ($_.isMe) { " (eu)" } else { "" }) }

Write-Host "`n== config ==" -ForegroundColor Cyan
$config = Invoke-RestMethod "$base/config"
@{ currency = $config.currency; locale = $config.locale; materials = $config.materials.Count; pointsPerKg = $config.pointsPerKg; legal = $config.legal; supportEmail = $config.supportEmail; version = $config.version } | ConvertTo-Json -Depth 5 -Compress

Write-Host "`n== payments: packs + mock checkout + mock complete ==" -ForegroundColor Cyan
$packs = Invoke-RestMethod "$base/payments/packs" -Headers $h
$packs.items | ForEach-Object { "  pack: {0} -> {1}c credit + {2} pts for {3}c ({4})" -f $_.id, $_.creditCents, $_.bonusPoints, $_.priceCents, $_.label }
$checkout = PostJson "$base/payments/checkout" @{ packId = "pack-20"; successUrl = "recio://wallet?status=success"; cancelUrl = "recio://wallet?status=cancel" } ($h + @{ "Idempotency-Key" = [guid]::NewGuid().ToString() })
$paid = PostJson "$base/payments/$($checkout.payment.id)/mock-complete" @{} $h
$paidAgain = PostJson "$base/payments/$($checkout.payment.id)/mock-complete" @{} $h
@{ payment = @{ id = $checkout.payment.id; status = $checkout.payment.status; provider = $checkout.payment.provider; checkoutUrl = $checkout.payment.checkoutUrl }; afterComplete = @{ status = $paid.payment.status; creditCents = $paid.wallet.creditCents; withdrawableCents = $paid.wallet.withdrawableCents }; secondCall = @{ status = $paidAgain.payment.status; creditCents = $paidAgain.wallet.creditCents } } | ConvertTo-Json -Depth 5 -Compress

Write-Host "`n== payout ==" -ForegroundColor Cyan
$payout = PostJson "$base/payouts" @{ amountCents = 2000; pixKey = "marina@example.com"; pixKeyType = "email" } ($h + @{ "Idempotency-Key" = [guid]::NewGuid().ToString() })
@{ payout = $payout.payout; withdrawableCents = (Invoke-RestMethod "$base/me" -Headers $h).wallet.withdrawableCents } | ConvertTo-Json -Depth 4 -Compress

Write-Host "`n== notifications + referral ==" -ForegroundColor Cyan
$notifications = Invoke-RestMethod "$base/notifications" -Headers $h
@{ unread = $notifications.unread; items = $notifications.items.Count; first = $notifications.items[0].title } | ConvertTo-Json -Compress
$referral = Invoke-RestMethod "$base/referral" -Headers $h
$referral | ConvertTo-Json -Depth 4 -Compress

Write-Host "`n== admin: login, metrics, CSV ==" -ForegroundColor Cyan
PostJson "$base/auth/request-otp" @{ identifier = "+5511988880000" } | Out-Null
$adminAuth = PostJson "$base/auth/verify" @{ identifier = "+5511988880000"; code = "123456" }
$adminH = @{ Authorization = "Bearer $($adminAuth.accessToken)" }
$metrics = Invoke-RestMethod "$base/admin/metrics" -Headers $adminH
@{ users = $metrics.users; depositsTotal = $metrics.depositsTotal; pointsIssued = $metrics.pointsIssued; redemptionRate = $metrics.redemptionRate; payoutPendingCents = $metrics.payoutPendingCents; machines = $metrics.machines; kgTotal = $metrics.kgTotal; co2SavedKg = $metrics.co2SavedKg } | ConvertTo-Json -Depth 4 -Compress
$csv = curl.exe -s -H "Authorization: Bearer $($adminAuth.accessToken)" "$base/admin/deposits.csv"
($csv -split "`r?`n")[0..2] | ForEach-Object { "  csv: $_" }

Write-Host "`nOK" -ForegroundColor Green
