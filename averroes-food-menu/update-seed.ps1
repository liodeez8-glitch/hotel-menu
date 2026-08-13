$root = 'c:\Users\DELL\Downloads\averroes-food-menu'
$html = [System.IO.File]::ReadAllText("$root\index.html", [System.Text.Encoding]::UTF8)
$dataJs = [System.IO.File]::ReadAllText("$root\assets\js\data.js", [System.Text.Encoding]::UTF8)

# --- Extract sections and their articles from the static customer menu ---
$sectionPattern = '(?s)<section id="section-([a-z0-9-]+)"[^>]*>.*?</section>'
$articlePattern = '(?s)<article[^>]*data-id="([^"]+)"[^>]*data-name="([^"]+)"[^>]*data-price="(\d+)"[^>]*>.*?<img src="([^"]*)"'

$mealLines = New-Object System.Collections.Generic.List[string]
$sections = [regex]::Matches($html, $sectionPattern)
foreach ($s in $sections) {
  $catId = $s.Groups[1].Value
  $articles = [regex]::Matches($s.Value, $articlePattern)
  foreach ($a in $articles) {
    $id = $a.Groups[1].Value
    $name = $a.Groups[2].Value -replace '&amp;', '&'
    $price = $a.Groups[3].Value
    $img = $a.Groups[4].Value
    $nameJson = $name -replace '\\', '\\\\' -replace '"', '\"'
    $imgJson = $img -replace '\\', '\\\\' -replace '"', '\"'
    $mealLines.Add("  {`"id`":`"$id`",`"name`":`"$nameJson`",`"categoryId`":`"$catId`",`"price`":$price,`"image`":`"$imgJson`",`"available`":true,`"outOfStock`":false,`"hidden`":false}")
  }
}
Write-Host ("Sections found: " + $sections.Count)
Write-Host ("Meals extracted: " + $mealLines.Count)

# --- Rebuild the MEALS block in data.js ---
$mealsBlock = "const MEALS = [`n" + ($mealLines -join ",`n") + "`n];"
$dataJs = [regex]::Replace($dataJs, '(?s)const MEALS = \[.*?\];', { param($m) $mealsBlock })

# --- Add drinks and poolside-bar categories to the seed ---
$dataJs = $dataJs.Replace(
  "    { id: 'special-coffee', title: 'Special Coffee', subtitle: 'Artisan coffee, teas and espresso.', order: 15 }",
  "    { id: 'special-coffee', title: 'Special Coffee', subtitle: 'Artisan coffee, teas and espresso.', order: 15 },`n    { id: 'drinks', title: 'Drinks', subtitle: 'Chilled soft drinks, juices and refreshments.', order: 16 },`n    { id: 'poolside-bar', title: 'Poolside Bar', subtitle: 'Cocktails, beers and refreshing drinks served by the pool.', order: 17 }"
)

[System.IO.File]::WriteAllText("$root\assets\js\data.js", $dataJs, (New-Object System.Text.UTF8Encoding($false)))
Write-Host "data.js updated."
