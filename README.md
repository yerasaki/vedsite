# [vedsite.com](https://vedsite.com)
frontend deployed on cloudflare pages <br>
backend api self-hosted on my raspberry pi 5: flask + docker, exposed via cloudflare tunnel <br>
ssh portfolio on port 22, built with go + charm's wish & bubble tea frameworks. oracle cloud free-tier vm acts as a public tcp relay via socat → pi over tailscale <br>
ssh portfolio.vedsite.com

# project structure
```
vedsite/
├── font/
│   └── SF-Pro-Display-Medium.otf
├── frontend/
│   ├── about/
│   │   ├── about.css
│   │   └── about.js
│   ├── home/
│   │   ├── home.css
│   │   └── home.js
│   ├── lightemall/
│   │   ├── lightemall.css
│   │   └── lightemall.js
│   ├── sanguine/
│   │   ├── sanguine.css
│   │   └── sanguine.js
│   ├── subpage/
│   │   ├── subpage.css
│   │   └── subpage.js
│   ├── subproject/
│   │   ├── subprojects.css
│   │   └── subprojects.js
│   ├── experience.css
│   └── misc.css
├── icons/
│   ├── favicon/
│   │   ├── apple-touch-icon.png
│   │   ├── favicon-96x96.png
│   │   ├── favicon.ico
│   │   ├── favicon.svg
│   │   ├── web-app-manifest-192x192.png
│   │   └── web-app-manifest-512x512.png
│   ├── bird.jpg
│   ├── bird.png
│   ├── color_palette.png
│   ├── email.png
│   ├── email.svg
│   ├── github.svg
│   ├── lastfm.svg
│   ├── letterboxd.svg
│   ├── linkedin.png
│   ├── linkedin.svg
│   ├── serializd.svg
│   ├── spotify.svg
│   ├── strava.svg
│   ├── tab_icon.png
│   └── web.svg
├── media/
│   ├── about/
│   │   ├── 1.jpg
│   │   ├── 2.jpeg
│   │   ├── 3.mp4
│   │   ├── 4.jpeg
│   │   ├── 5.jpeg
│   │   ├── 6.jpeg
│   │   ├── 7.jpeg
│   │   ├── 8.mov
│   │   ├── 9.mov
│   │   └── 10.jpeg
│   ├── carbon/
│   │   ├── carbon_loss.png
│   │   └── carbon_win.mp4
│   ├── pl/
│   │   ├── linear.png
│   │   └── polynomial.png
│   ├── preview/
│   │   ├── carbon_preview.png
│   │   ├── lightemall_preview.png
│   │   ├── pl_preview.jpg
│   │   ├── pl_preview.png
│   │   ├── sanguine_preview.png
│   │   ├── squashhub_preview.png
│   │   └── ssh_preview.png
│   ├── sq/
│   │   ├── schema_preview.png
│   │   ├── sq_admin.mp4
│   │   ├── sq_attendance.mp4
│   │   ├── sq_email.png
│   │   ├── sq_events.mp4
│   │   ├── sq_guest.mp4
│   │   └── sq_welcome.png
│   └── ssh/
│       ├── ssh_demo.mp4
│       └── ssh_subproject.png
├── projects/
│   ├── carbon_neutrality.html
│   ├── lightemall.html
│   ├── pl.html
│   ├── sanguine.html
│   ├── squashhub.html
│   └── ssh.html
├── stats/
│   ├── Dockerfile
│   ├── docker-compose.yml
│   ├── requirements.txt
│   ├── server.py
│   └── top4.json
├── .gitignore
├── LICENSE
├── README.md
├── Ved_Deshpande_Resume.pdf
├── about.html
├── experience.html
├── index.html
├── main.go
├── manifest.json
├── misc.html
├── projects.html
└── sw.js
```
