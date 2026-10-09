# Lo carga `sim.sh test` (usa sus funciones: k, kc, say, secret_val…).
# Comprueba la topología, el firewall, los runners en paralelo, la caída de un runner y un curso de punta a punta.

PASS=0
FAIL=0
ok() { PASS=$((PASS + 1)); printf '  ✓ %s\n' "$*"; }
bad() { FAIL=$((FAIL + 1)); printf '  ✗ %s\n' "$*"; }
# check "qué se comprueba" comando…   (ok si el comando termina bien)
check() { local d="$1"; shift; if "$@" >/dev/null 2>&1; then ok "$d"; else bad "$d"; fi; }
# denied "qué debe quedar bloqueado" comando…   (ok si el comando falla)
denied() { local d="$1"; shift; if "$@" >/dev/null 2>&1; then bad "$d (llegó)"; else ok "$d"; fi; }

ADMIN_TOKEN="$(secret_val byox-app BYOX_TOKEN)"
api() { k exec deploy/forgejo -c forgejo -- curl -fsS -H "Authorization: token $ADMIN_TOKEN" -H 'Content-Type: application/json' "$@"; }
FJ=http://localhost:3000/api/v1
MCP=http://127.0.0.1:13333
node_of() { k get pod "$1" -o jsonpath='{.spec.nodeName}'; }
runners_json() { api "$FJ/admin/actions/runners"; }
psql_byox() { k exec postgres-0 -- psql -U postgres -d byox -Atc "$1"; }

# Un token personal del dueño, creado entrando como lo haría la web.
MCP_TOKEN=""
mcp_token() {
  [ -n "$MCP_TOKEN" ] && return
  local pass cookie
  pass="$(secret_val byox-admin password)"
  cookie="$(curl -si -X POST "$MCP/api/auth/login" -H 'Content-Type: application/json' \
    -d "{\"username\":\"$BYOX_USER\",\"password\":\"$pass\"}" | grep -i '^set-cookie:' | sed -E 's/^[^:]*: *([^;]*);.*/\1/' | tr -d '\r')"
  MCP_TOKEN="$(curl -s -X POST "$MCP/api/auth/tokens" -H 'Content-Type: application/json' -H "Cookie: $cookie" \
    -d '{"name":"sim"}' | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')"
  [ -n "$MCP_TOKEN" ]
}
# Una herramienta del MCP: mcp_tool nombre '{"slug":"x"}'
mcp_tool() {
  curl -s -X POST "$MCP/mcp" -H "Authorization: Bearer $MCP_TOKEN" -H 'Content-Type: application/json' \
    -H 'Accept: application/json, text/event-stream' \
    -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/call\",\"params\":{\"name\":\"$1\",\"arguments\":$2}}"
}
push_course() {
  docker run --rm -e BYOX_TOKEN="$MCP_TOKEN" -e BYOX_MCP=http://host.docker.internal:13333/mcp \
    -v "$(cygpath -w "$PWD/../..")":/w -w /w node:22-bookworm-slim \
    node scripts/push-course.mjs examples/build-your-own-calc "$@"
}

say "Topología: cada servicio en su VPS"
check "postgres en la VPS A" test "$(node_of postgres-0)" = "$NODE_A"
check "forgejo en la VPS A" test "$(node_of "$(k get pod -l app=forgejo -o name | head -1 | cut -d/ -f2)")" = "$NODE_A"
check "mcp en la VPS A" test "$(node_of "$(k get pod -l app=mcp -o name | head -1 | cut -d/ -f2)")" = "$NODE_A"
NODES="$(k get pod -l app=runner -o jsonpath='{range .items[*]}{.spec.nodeName}{"\n"}{end}')"
check "los runners caen en VPS de tipo B (B o B2)" test -z "$(echo "$NODES" | grep -vE "^($NODE_B|$NODE_B2)$")"
check "los runners están en VPS distintas (anti-afinidad)" test "$(echo "$NODES" | sort -u | wc -l)" -eq "$(echo "$NODES" | wc -l)"

say "Firewall entre VPS"
RUNNER_EXEC=(k exec runner-0 -c runner --)
check "runner -> forgejo:3000" "${RUNNER_EXEC[@]}" wget -T3 -qO- http://forgejo:3000/api/healthz
check "runner -> mcp:3333" "${RUNNER_EXEC[@]}" wget -T3 -qO- http://mcp:3333/health
denied "runner -> postgres:5432 bloqueado" "${RUNNER_EXEC[@]}" nc -z -w3 postgres 5432
denied "forgejo -> docker del runner bloqueado" k exec deploy/forgejo -c forgejo -- curl -m3 -fs http://runner-0.runner:2375/_ping
denied "runner-1 -> docker de runner-0 bloqueado" k exec runner-1 -c runner -- wget -T3 -qO- http://runner-0.runner:2375/_ping
check "mcp -> docker de un runner" k exec deploy/mcp -- sh -c 'DOCKER_HOST="tcp://runner-0.runner:2375" docker version'
check "el pool del mcp (runner) resuelve a todos los runners" \
  test "$(k exec deploy/mcp -- getent hosts runner | wc -l)" -eq "$(k get pod -l app=runner --no-headers | wc -l)"

say "Runners: cada uno con su registración"
R="$(runners_json)"
# Los registros viejos (un pod recreado deja uno offline con el mismo nombre) no cuentan.
ONLINE="$(echo "$R" | grep -oE '\{[^{}]*"status":"(idle|active)"[^{}]*\}')"
check "hay 2 runners en línea" test "$(echo "$ONLINE" | grep -c .)" -eq 2
check "uuids distintos" test "$(echo "$ONLINE" | grep -o '"uuid":"[^"]*"' | sort -u | wc -l)" -eq 2
check "se llaman como su pod (runner-0, runner-1)" test "$(echo "$ONLINE" | grep -oE '"name":"runner-[01]"' | sort -u | wc -l)" -eq 2
check "PDB del runner con maxUnavailable 1" test "$(k get pdb runner -o jsonpath='{.spec.maxUnavailable}')" = 1
check "sin PDB en Postgres ni Forgejo" test "$(k get pdb -o name | grep -vc '/runner$')" -eq 0

say "Dos pushes a la vez -> dos runners distintos"
probe() {
  api -X DELETE "$FJ/repos/$BYOX_USER/runner-probe" >/dev/null 2>&1 || true
  api -X POST "$FJ/user/repos" -d '{"name":"runner-probe","private":true,"auto_init":true,"default_branch":"main"}' >/dev/null
  local wf
  wf="$(printf 'on:\n  push:\n    branches: ["probe-*"]\njobs:\n  probe:\n    runs-on: docker\n    steps:\n      - run: sleep 45\n' | base64 | tr -d '\n')"
  api -X POST "$FJ/repos/$BYOX_USER/runner-probe/contents/.forgejo/workflows/probe.yml" \
    -d "{\"content\":\"$wf\",\"message\":\"probe\",\"branch\":\"main\"}" >/dev/null
  # Dos pushes (dos ramas nuevas) lanzados a la vez.
  local body='{"content":"eA==","message":"push","branch":"main","new_branch":"%s"}'
  for b in probe-1 probe-2; do
    api -X POST "$FJ/repos/$BYOX_USER/runner-probe/contents/$b.txt" -d "$(printf "$body" "$b")" >/dev/null &
  done
  wait
  # Esperar a que los dos runners estén ocupados a la vez (la primera vez baja la imagen del job en cada Docker).
  local seen="" n=0
  for _ in $(seq 1 120); do
    seen="$(runners_json | grep -oE '"name":"runner-[0-9]+","status":"active"' | sort -u)"
    n="$(echo -n "$seen" | grep -c . || true)"
    [ "$n" -ge 2 ] && break
    sleep 5
  done
  echo "$seen"
  [ "$n" -ge 2 ]
}
if out="$(probe 2>&1)"; then
  ok "los dos jobs corrieron a la vez en pods distintos:"
  echo "$out" | grep -oE 'runner-[0-9]+' | while read -r pod; do echo "      $pod -> $(node_of "$pod")"; done
else
  bad "no se vieron dos runners ocupados a la vez"
  echo "$out" | tail -5 | sed 's/^/      /'
fi
api -X DELETE "$FJ/repos/$BYOX_USER/runner-probe" >/dev/null 2>&1 || true

say "Un curso de punta a punta (escribir, verificar, empezar)"
if ! mcp_token; then
  bad "no pude crear un token personal"
elif out="$(push_course --verify --start --reset 2>&1)"; then
  ok "write + validate + verify_course + start_course"
  echo "$out" | grep -E "✅|❌" | head -4 | sed 's/^/      /'
else
  bad "el curso falló"
  echo "$out" | tail -12 | sed 's/^/      /'
fi

say "Se cae un runner: las verificaciones siguen"
if [ -n "$MCP_TOKEN" ]; then
  k delete pod runner-0 --wait=false >/dev/null
  # Dos seguidas: con el reparto por turnos, una de las dos habría elegido el runner caído.
  for i in 1 2; do
    out="$(mcp_tool verify_course '{"slug":"build-your-own-calc"}')"
    if echo "$out" | grep -q "Todo en orden" && ! echo "$out" | grep -q '"isError":true'; then
      ok "verify_course #$i con runner-0 caído"
    else
      bad "verify_course #$i con runner-0 caído"; echo "$out" | head -c 400 | sed 's/^/      /'; echo
    fi
  done
  check "runner-0 vuelve" k wait --for=condition=Ready pod/runner-0 --timeout=240s
fi

say "Un push del alumno llega al MCP desde la VPS B"
if [ -n "$MCP_TOKEN" ]; then
  before="$(psql_byox "select coalesce(extract(epoch from max(updated_at)),0) from kv where ns='results'")"
  api -X POST "$FJ/repos/$BYOX_USER/build-your-own-calc/contents/notas-$(date +%s).txt" \
    -d '{"content":"eA==","message":"push del alumno"}' >/dev/null
  after="$before"
  for _ in $(seq 1 120); do
    after="$(psql_byox "select coalesce(extract(epoch from max(updated_at)),0) from kv where ns='results'")"
    [ "$after" != "$before" ] && break
    sleep 5
  done
  if [ "$after" != "$before" ]; then
    ok "el job avance (en un runner) mandó los resultados a /hooks/results y quedaron en Postgres"
    psql_byox "select key from kv where ns='results'" | sed 's/^/      /'
  else
    bad "no llegaron resultados al MCP en 10 minutos"
  fi
fi

say "Uso medido"
if [ -n "$MCP_TOKEN" ]; then
  u="$(curl -s "$MCP/api/usage" -H "Authorization: Bearer $MCP_TOKEN")"
  echo "      $u"
  check "cuenta el curso empezado este mes" grep -q 'build-your-own-calc' <<<"$u"
  check "cuenta llamadas al MCP de la semana" grep -qE '"mcpCalls":[1-9]' <<<"$u"
fi

echo
echo "$PASS bien, $FAIL mal"
[ "$FAIL" -eq 0 ]
