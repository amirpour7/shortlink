# Source Code Guide

This folder contains the application implementation. Public functions and
important internal helpers are documented with JSDoc comments beside the code.
The main responsibilities are:

- `config/`: load and validate environment-based application settings and build the OpenAPI document.
- `db/`: create, initialize and close the SQLite connection.
- `repositories/`: execute parameterized SQL statements and return database records.
- `services/`: implement URL validation, short-code creation and persistence workflows.
- `routes/`: translate HTTP requests into service calls and HTTP responses.
- `middleware/`: normalize unregistered routes and application/parser errors.

For generated API documentation, start the server and open `/api-docs`.
The raw OpenAPI JSON is available at `/api-docs.json` when Swagger is enabled.
