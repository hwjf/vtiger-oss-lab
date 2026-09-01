# Local Vtiger 8.x Lab

This lab builds fresh Vtiger Open Source 8.0 through 8.4 installations from checksum-verified
official release archives. Each version has its own MariaDB database, application volume, and
internal Docker network.

Requirements: Docker with Compose v2 and Node.js 18 or newer for matrix export.

## Start

For reproducible fresh-install results, remove all state before starting:

```sh
docker compose down --volumes --remove-orphans
docker compose up --build -d
docker compose ps
```

The installer runs automatically after Apache and MariaDB are available. Initial compilation and
installation can take several minutes.

| Version | URL                   |
| ------- | --------------------- |
| 8.0     | http://localhost:8180 |
| 8.1     | http://localhost:8181 |
| 8.2     | http://localhost:8182 |
| 8.3     | http://localhost:8183 |
| 8.4     | http://localhost:8184 |

Lab administrator credentials are `admin` / `vtiger-lab-admin`. Database passwords and the
webservice access key are also fixed synthetic values in `compose.yml`. They exist only to make the
localhost lab reproducible and must never be reused or exposed outside a trusted local workstation.

After all services are healthy, export registrations, handler signatures, and safe API probes:

```sh
node export-matrix.mjs
```

The generated matrix is written to `matrix/fresh-8.x.json`.

## Reset

This deletes all lab databases and application state:

```sh
docker compose down --volumes --remove-orphans
```

Do not expose these containers to other hosts. Published ports bind only to `127.0.0.1`; other
processes and users on the same workstation can still reach them.

## Licensing

The lab automation is MIT licensed. Vtiger is downloaded during the build and remains governed by
its own upstream licenses and notices. See `THIRD_PARTY_NOTICES.md`.
