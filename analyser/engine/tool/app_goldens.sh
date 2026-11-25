#!/usr/bin/env bash
# Records the app goldens (analyser/goldens/*.golden.json) from a
# pesaclarity-app checkout with Flutter and PDFium set up (`flutter pub get`
# and one `flutter test` there build PDFium for the host):
#   analyser/engine/tool/app_goldens.sh PATH_TO_PESACLARITY_APP
set -euo pipefail
here=$(cd "$(dirname "$0")/../.." && pwd)
app=$(cd "$1" && pwd)
test="$app/test/zz_web_analyser_goldens_test.dart"
cp "$here/engine/tool/app_goldens_test.dart" "$test"
trap 'rm -f "$test"' EXIT
mkdir -p "$here/goldens"
(cd "$app" && APP_COMMIT=$(git rev-parse HEAD) ANALYSER_FIXTURES="$here/fixtures" \
  ANALYSER_GOLDENS="$here/goldens" flutter test "$test")
