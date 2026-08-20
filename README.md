# Local vtiger 8.x Lab

This lab builds fresh vtiger OSS 8.0 through 8.4 installations from checksum-verified official
release archives. Each version has an isolated MariaDB database and application volume.

## Start

```sh
docker compose -f test/lab/compose.yml up --build -d
docker compose -f test/lab/compose.yml ps
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

Lab administrator credentials are `admin` / `vtiger-lab-admin`. They are intentionally fixed and
must never be used outside this isolated localhost lab.

After all services are healthy, export registrations, handler signatures, and safe API probes:

```sh
npm run lab:matrix
```

The generated matrix is written to `test/lab/matrix/fresh-8.x.json`.

## Reset

This deletes all lab databases and application state:

```sh
docker compose -f test/lab/compose.yml down --volumes
```

Do not expose these containers to other hosts. Published ports bind only to `127.0.0.1`.
