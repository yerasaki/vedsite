# [vedsite.com](https://vedsite.com)
frontend deployed on cloudflare pages <br>
backend api self-hosted on my raspberry pi 5: flask + docker, exposed via cloudflare tunnel <br>
ssh portfolio on port 22, built with go + charm's wish & bubble tea frameworks. runs natively on an oracle cloud free-tier vm and mirrors the whole site: photos as colour ascii art, projects, experience, live misc data and search. source: [deshpande-ved/ssh-portfolio](https://github.com/deshpande-ved/ssh-portfolio) <br>
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
│   ├── misc.css
│   ├── misc.js
│   └── shared.css
├── icons/
│   ├── favicon/
│   │   ├── apple-touch-icon.png
│   │   ├── favicon-96x96.png
│   │   ├── favicon.ico
│   │   ├── favicon.svg
│   │   ├── web-app-manifest-192x192.png
│   │   └── web-app-manifest-512x512.png
│   ├── email.svg
│   ├── github.svg
│   ├── lastfm.svg
│   ├── letterboxd.svg
│   ├── linkedin.svg
│   ├── serializd.svg
│   ├── spotify.svg
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
│   ├── cctv/
│   │   ├── demo.mp4
│   │   └── feed.png
│   ├── homeassistant/
│   │   ├── apple_home.mp4
│   │   ├── apple_home.png
│   │   ├── kiosk.png
│   │   ├── mbta.mp4
│   │   ├── mbta.png
│   │   ├── nfc.mp4
│   │   ├── phone.png
│   │   └── wall.jpg
│   ├── homelab/
│   │   ├── panel.png
│   │   ├── piplay.mp4
│   │   └── shelf.jpg
│   ├── pl/
│   │   ├── linear.png
│   │   └── polynomial.png
│   ├── preview/
│   │   ├── carbon_preview.png
│   │   ├── cctv_preview.jpg
│   │   ├── homeassistant_preview.jpg
│   │   ├── homelab_preview.jpg
│   │   ├── lightemall_preview.png
│   │   ├── localai_preview.png
│   │   ├── patrick_preview.png
│   │   ├── pl_preview.jpg
│   │   ├── sanguine_preview.png
│   │   ├── squashhub_preview.png
│   │   ├── ssh_preview.png
│   │   ├── stopeating_preview.jpg
│   │   └── wallmount_preview.jpg
│   ├── sq/
│   │   ├── schema_preview.png
│   │   ├── sq_admin.mp4
│   │   ├── sq_attendance.mp4
│   │   ├── sq_email.png
│   │   ├── sq_events.mp4
│   │   ├── sq_guest.mp4
│   │   └── sq_welcome.png
│   ├── ssh/
│   │   ├── ssh_about.mp4
│   │   ├── ssh_experience.mp4
│   │   ├── ssh_home.mp4
│   │   ├── ssh_misc.png
│   │   ├── ssh_projects.mp4
│   │   ├── ssh_search.mp4
│   │   └── ssh_small.png
│   ├── stopeating/
│   │   ├── banned.png
│   │   ├── item_open.png
│   │   └── report.png
│   └── wallmount/
│       ├── lift.mp4
│       ├── tablet.jpg
│       └── turntable.gif
├── projects/
│   ├── carbon_neutrality.html
│   ├── cctv.html
│   ├── homeassistant.html
│   ├── homelab.html
│   ├── lightemall.html
│   ├── localai.html
│   ├── patrick.html
│   ├── pl.html
│   ├── sanguine.html
│   ├── squashhub.html
│   ├── ssh.html
│   ├── stopeating.html
│   └── wallmount.html
├── .gitignore
├── LICENSE
├── README.md
├── Ved_Deshpande_Resume.pdf
├── about.html
├── experience.html
├── index.html
├── manifest.json
├── misc.html
├── projects.html
└── sw.js
```
