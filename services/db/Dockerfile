# Base image
FROM postgres:16-alpine

# Run create.sql on init
#ADD create.sql /docker-entrypoint-initdb.d
ARG PORT=5432

RUN echo "Postgres port: $PORT"

EXPOSE ${PORT}

CMD ["postgres"]