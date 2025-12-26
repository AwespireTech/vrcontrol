To Run:
```bash
docker compose up
```

The application will be available at http://localhost:8080

To Connect a player in to a room, use url: 'http://localhost:8080/client/<player_id>'

Further control of the server is done by api calls, and the monitoring service is run at 'http://localhost:8080/ws/control/<roomId>'
