# Arquivos que devem ser configurados

## Google tasks

File: `google-tasks.json`

Download de google api
```
{
	"web": {
		"client_id": "",
		"project_id": "senac-to-tasks",
		"auth_uri": "https://accounts.google.com/o/oauth2/auth",
		"token_uri": "https://oauth2.googleapis.com/token",
		"auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
		"client_secret": "",
		"redirect_uris": ["http://localhost:5000/oauth2callback"],
		"javascript_origins": ["http://localhost:5000"]
	}
}
```


## Senac

File: `senac-blackboard.json`

```
{
    "user": "e-mail",
    "password": "senha",
	"codeCourse": "0000"
}
```
