# Fresh-Install Matrix Summary

Generated from checksum-verified official vtiger OSS release archives on PHP 8.2 and MariaDB
10.11. The full operation registry, handler signatures, and safe API probe results are stored in
`fresh-8.x.json`.

| Fresh version | Login/List Types | `files_retrieve`           | `convertlead` registration | `sync`                                  |
| ------------- | ---------------- | -------------------------- | -------------------------- | --------------------------------------- |
| 8.0.0         | Works            | `id` / `$file_id` mismatch | Modern encoded `element`   | Registration/handler mismatch; HTTP 500 |
| 8.1.0         | Works            | `id` / `$file_id` mismatch | Modern encoded `element`   | Registration/handler mismatch; HTTP 500 |
| 8.2.0         | Works            | `id` / `$file_id` mismatch | Modern encoded `element`   | Registration/handler mismatch; HTTP 500 |
| 8.3.0         | Works            | `id` / `$file_id` mismatch | Modern encoded `element`   | Registration/handler mismatch; HTTP 500 |
| 8.4.0         | Works            | Signature compatible       | Modern encoded `element`   | Registration/handler mismatch; HTTP 500 |

All five fresh installations register the same eleven `mobile.*` operations and five `wsapp_*`
operations. They remain accessible through the node's Advanced operations rather than first-class
actions.

These results describe fresh installations only. Upgrade paths can preserve different database
registrations and must be tested separately.
