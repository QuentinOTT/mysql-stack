FROM mysql:latest
COPY init.sql /docker-entrypoint-initdb.d/init.sql
COPY players.csv /docker-entrypoint-initdb.d/players.csv
COPY car_data.csv /docker-entrypoint-initdb.d/car_data.csv
