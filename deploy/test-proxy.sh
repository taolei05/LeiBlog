#!/usr/bin/env bash
set -Eeuo pipefail
api_image="${1:?API image required}"
web_image="${2:?Web image required}"
project="leiblog-proxy-test-$$"
# A disposable network simulates a real Cloudflare peer using its published range.
subnet="172.68.$((32 + $$ % 192))"
cleanup() {
  local code=$?
  if [[ "$code" -ne 0 ]]; then docker logs "$project-web" >&2 || true; fi
  docker rm -f "$project-web" "$project-api" >/dev/null 2>&1 || true
  docker network rm "$project-edge" "$project-direct" >/dev/null 2>&1 || true
}
trap cleanup EXIT
docker network create --internal --subnet "$subnet.0/29" "$project-edge" >/dev/null
docker network create --internal "$project-direct" >/dev/null
docker run -d --name "$project-api" --network "$project-edge" --ip "$subnet.3" --network-alias api \
  --env NODE_ENV=development --env "TRUSTED_PROXY_IPS=$subnet.2" \
  "$api_image" bun -e 'import {getRequestMeta} from "./src/shared/request-meta.ts"; Bun.serve({hostname:"0.0.0.0",port:3000,fetch(request,server){return Response.json(getRequestMeta({headers:Object.fromEntries(request.headers),requestIp:server.requestIP(request)?.address}))}});' >/dev/null
docker run -d --name "$project-web" --network "$project-edge" --ip "$subnet.2" \
  --env SITE_HOST=:80 "$web_image" >/dev/null
docker network connect --alias web "$project-direct" "$project-web"
docker run --rm --network "$project-edge" --ip "$subnet.4" \
  --env "TEST_URL=http://$subnet.2" "$api_image" bun -e '
const base=process.env.TEST_URL;
for(let i=0;;i++){try{const r=await fetch(base+"/api/health");if(r.ok)break;}catch{}if(i===29)throw new Error("Proxy startup timed out");await Bun.sleep(200);}
for(const path of ["/api/metadata","/uploads/metadata"]){
  for(const ip of ["203.0.113.9","2001:db8::1234"]){
    const r=await fetch(base+path,{headers:{"CF-Connecting-IP":ip,"CF-IPCountry":"CN","X-Leiblog-Country-Code":"US","X-Forwarded-For":"198.51.100.1"}});
    const meta=await r.json();
    if(meta.ip!==ip || meta.countryCode!=="CN")throw new Error("Cloudflare visitor metadata was not preserved: "+JSON.stringify(meta));
  }
  const r=await fetch(base+path,{headers:{"X-Forwarded-For":"198.51.100.1, 203.0.113.9"}});
  if((await r.json()).ip!=="203.0.113.9")throw new Error("Forwarded chain did not stop at the first untrusted hop");
}
'
docker run --rm --network "$project-direct" "$api_image" bun -e '
for(const path of ["/api/metadata","/uploads/metadata"]){
  const r=await fetch("http://web"+path,{headers:{"CF-Connecting-IP":"203.0.113.9","CF-IPCountry":"CN","X-Leiblog-Country-Code":"US","X-Forwarded-For":"198.51.100.1","X-Real-IP":"198.51.100.2"}});
  const meta=await r.json();
  if(meta.ip==="203.0.113.9" || meta.ip==="198.51.100.1" || meta.ip==="198.51.100.2" || meta.ip===null || meta.countryCode!==undefined)throw new Error("Direct request spoofed visitor metadata: "+JSON.stringify(meta));
}
'
printf '%s\n' 'Real Caddy Cloudflare IPv4/IPv6 visitor forwarding and direct-request spoof protection passed.'
