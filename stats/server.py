"""
flask backend for personal site
handles: Spotify and Strava (with auto token refresh), Last.fm, Letterboxd
"""

from flask import Flask, jsonify
import os
import re
import requests
import base64
import json
import time
import hashlib
import feedparser
from concurrent.futures import ThreadPoolExecutor

from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
    response.headers.add('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    return response

# CONFIGURATION

SPOTIFY_CLIENT_ID = os.environ["SPOTIFY_CLIENT_ID"]
SPOTIFY_CLIENT_SECRET = os.environ["SPOTIFY_CLIENT_SECRET"]
SPOTIFY_TOKENS_FILE = os.environ.get("SPOTIFY_TOKENS_FILE", "spotify_tokens.json")

LASTFM_API_KEY = os.environ["LASTFM_API_KEY"]
LASTFM_SECRET = os.environ["LASTFM_SECRET"]
LASTFM_SESSION_KEY = os.environ["LASTFM_SESSION_KEY"]
LASTFM_USER = os.environ.get("LASTFM_USER", "yerasaki")

LETTERBOXD_USER = os.environ.get("LETTERBOXD_USER", "yerasaki")

STRAVA_CLIENT_ID = os.environ["STRAVA_CLIENT_ID"]
STRAVA_CLIENT_SECRET = os.environ["STRAVA_CLIENT_SECRET"]
STRAVA_TOKENS_FILE = os.environ.get("STRAVA_TOKENS_FILE", "strava_tokens.json")

# TOKEN FILE HELPERS - shared by Spotify and Strava

def load_tokens(path, label):
    """Load tokens from file"""
    try:
        with open(path, 'r') as f:
            content = f.read()
            if not content.strip():
                print(f"ERROR: {label} tokens file is empty")
                return None
            return json.loads(content)
    except FileNotFoundError:
        print(f"ERROR: {label} tokens file not found")
        return None
    except json.JSONDecodeError as e:
        print(f"ERROR: {label} tokens file corrupted: {e}")
        return None

def save_tokens(path, tokens):
    """Save tokens atomically using os.replace"""
    tmp_path = path + '.tmp'

    with open(tmp_path, 'w') as f:
        json.dump(tokens, f)
        f.flush()
        os.fsync(f.fileno())

    # Verify temp file is valid JSON before replacing
    with open(tmp_path, 'r') as f:
        json.loads(f.read())

    # Atomic rename - never truncates destination without replacing
    os.replace(tmp_path, path)

# SPOTIFY - Token Management

def refresh_spotify_token():
    """Get new access token using refresh token"""
    tokens = load_tokens(SPOTIFY_TOKENS_FILE, "Spotify")
    if not tokens:
        return None
    
    if 'refresh_token' not in tokens:
        print("ERROR: No refresh_token in tokens file")
        return None
    
    auth_str = f"{SPOTIFY_CLIENT_ID}:{SPOTIFY_CLIENT_SECRET}"
    auth_base64 = base64.b64encode(auth_str.encode()).decode()
    
    response = requests.post(
        "https://accounts.spotify.com/api/token",
        headers={"Authorization": f"Basic {auth_base64}"},
        data={
            "grant_type": "refresh_token",
            "refresh_token": tokens['refresh_token']
        }
    )
    
    new_tokens = response.json()

    if 'access_token' not in new_tokens:
        print(f"ERROR: Spotify refresh failed: {new_tokens}")
        return None

    # Spotify returns a relative expires_in delta; 300s buffer forces early refresh.
    tokens['access_token'] = new_tokens['access_token']
    tokens['expires_at'] = time.time() + new_tokens['expires_in'] - 300
    save_tokens(SPOTIFY_TOKENS_FILE, tokens)

    return tokens['access_token']

def get_spotify_token():
    """Get valid token, refreshing if expired"""
    tokens = load_tokens(SPOTIFY_TOKENS_FILE, "Spotify")
    if not tokens:
        return None
    
    if time.time() >= tokens.get('expires_at', 0):
        print("Token expired, refreshing...")
        return refresh_spotify_token()
    
    return tokens.get('access_token')

def spotify_request(endpoint):
    """Make authenticated Spotify API request"""
    token = get_spotify_token()
    if not token:
        return None
    
    response = requests.get(
        f"https://api.spotify.com/v1{endpoint}",
        headers={"Authorization": f"Bearer {token}"}
    )
    return response

# STRAVA - Token Management

def refresh_strava_token():
    """Get new access token using refresh token. Strava rotates refresh tokens,
    so we persist whatever comes back."""
    tokens = load_tokens(STRAVA_TOKENS_FILE, "Strava")
    if not tokens:
        return None

    if 'refresh_token' not in tokens:
        print("ERROR: No refresh_token in Strava tokens file")
        return None

    response = requests.post(
        "https://www.strava.com/api/v3/oauth/token",
        data={
            "client_id": STRAVA_CLIENT_ID,
            "client_secret": STRAVA_CLIENT_SECRET,
            "grant_type": "refresh_token",
            "refresh_token": tokens['refresh_token']
        }
    )

    new_tokens = response.json()

    if 'access_token' not in new_tokens:
        print(f"ERROR: Strava refresh failed: {new_tokens}")
        return None

    # Strava returns a fresh refresh_token each time — persist it.
    # expires_at is already an absolute epoch timestamp from Strava (unlike Spotify's
    # expires_in delta), but we subtract 300s for the same early-refresh buffer.
    tokens['access_token'] = new_tokens['access_token']
    tokens['refresh_token'] = new_tokens['refresh_token']
    tokens['expires_at'] = new_tokens['expires_at'] - 300
    save_tokens(STRAVA_TOKENS_FILE, tokens)

    return tokens['access_token']

def get_strava_token():
    """Get valid token, refreshing if expired"""
    tokens = load_tokens(STRAVA_TOKENS_FILE, "Strava")
    if not tokens:
        return None

    if time.time() >= tokens.get('expires_at', 0):
        print("Strava token expired, refreshing...")
        return refresh_strava_token()

    return tokens.get('access_token')

def strava_request(endpoint, params=None):
    """Make authenticated Strava API request"""
    token = get_strava_token()
    if not token:
        return None

    response = requests.get(
        f"https://www.strava.com/api/v3{endpoint}",
        headers={"Authorization": f"Bearer {token}"},
        params=params or {}
    )
    return response

# SPOTIFY ENDPOINTS

@app.route('/api/spotify/now-playing')
def spotify_now_playing():
    """Get currently playing track with progress"""
    response = spotify_request("/me/player/currently-playing")
    
    if response is None:
        return jsonify({"error": "Spotify authentication failed - tokens may need refresh"}), 503
    
    if response.status_code == 200:
        data = response.json()
        track = data['item']
        return jsonify({
            "is_playing": data['is_playing'],
            "track_name": track['name'],
            "artist_name": track['artists'][0]['name'],
            "album_name": track['album']['name'],
            "album_image": track['album']['images'][0]['url'],  # 640x640
            "progress_ms": data['progress_ms'],
            "duration_ms": track['duration_ms'],
            "track_url": track['external_urls']['spotify']
        })
    
    elif response.status_code == 204:
        # Nothing playing - get last played
        response = spotify_request("/me/player/recently-played?limit=1")
        if response is None:
            return jsonify({"error": "Spotify authentication failed"}), 503
        if response.status_code == 200:
            data = response.json()
            track = data['items'][0]['track']
            return jsonify({
                "is_playing": False,
                "track_name": track['name'],
                "artist_name": track['artists'][0]['name'],
                "album_name": track['album']['name'],
                "album_image": track['album']['images'][0]['url'],
                "progress_ms": 0,
                "duration_ms": track['duration_ms'],
                "track_url": track['external_urls']['spotify']
            })
    
    return jsonify({"error": "Could not fetch data"}), 500


@app.route('/api/spotify/queue')
def spotify_queue():
    """Get current queue"""
    response = spotify_request("/me/player/queue")
    
    if response is None:
        return jsonify({"queue": [], "error": "Spotify unavailable"})
    
    if response.status_code == 200:
        data = response.json()
        
        queue = []
        for track in data.get('queue', [])[:4]:
            queue.append({
                "track_name": track['name'],
                "artist_name": track['artists'][0]['name'],
                "album_image": track['album']['images'][2]['url']  # 64x64 thumbnail
            })
        
        return jsonify({"queue": queue})
    
    return jsonify({"queue": []})


@app.route('/api/spotify/recently-played')
def spotify_recently_played():
    """Get recently played tracks (used when playback is idle).
    Pulls 20 so the frontend can dedupe repeats and still surface 5 unique."""
    response = spotify_request("/me/player/recently-played?limit=20")
    if response is None:
        return jsonify({"tracks": [], "error": "Spotify unavailable"})
    if response.status_code == 200:
        data = response.json()
        tracks = []
        for item in data.get('items', []):
            track = item['track']
            tracks.append({
                "track_name": track['name'],
                "artist_name": track['artists'][0]['name'],
                "album_image": track['album']['images'][2]['url'],  # 64x64
                "played_at": item.get('played_at'),
            })
        return jsonify({"tracks": tracks})
    return jsonify({"tracks": []})

# STRAVA ENDPOINTS

@app.route('/api/strava/recent')
def strava_recent():
    """Get 4 most recent activities with time, distance, calories"""
    response = strava_request("/athlete/activities", params={"per_page": 4, "page": 1})

    if response is None:
        return jsonify({"error": "Strava authentication failed"}), 503

    if response.status_code != 200:
        return jsonify({"error": f"Strava API error: {response.status_code}"}), 500

    activities = response.json()
    results = []

    for a in activities:
        # Calories require a per-activity detail call (not in the list endpoint)
        detail_resp = strava_request(f"/activities/{a['id']}")
        calories = None
        if detail_resp is not None and detail_resp.status_code == 200:
            calories = detail_resp.json().get('calories')

        results.append({
            "name": a['name'],
            "type": a['type'],
            "start_date_local": a['start_date_local'],
            "moving_time": a['moving_time'],      # seconds
            "elapsed_time": a['elapsed_time'],    # seconds
            "distance": a['distance'],            # meters
            "calories": calories,                 # kcal, may be null
            "activity_url": f"https://www.strava.com/activities/{a['id']}",
        })

    return jsonify(results)

# LAST.FM ENDPOINTS
@app.route('/api/lastfm/top-artists')
def lastfm_top_artists():
    """Get top 5 artists for this month with play counts and images from Spotify"""
    
    # Build signature (Last.fm requires alphabetically sorted params)
    sig_string = f"api_key{LASTFM_API_KEY}limit5methoduser.gettopartistsperiod1monthsk{LASTFM_SESSION_KEY}user{LASTFM_USER}{LASTFM_SECRET}"
    api_sig = hashlib.md5(sig_string.encode('utf-8')).hexdigest()
    
    response = requests.get(
        "http://ws.audioscrobbler.com/2.0/",
        params={
            "method": "user.gettopartists",
            "period": "1month",
            "user": LASTFM_USER,
            "limit": 5,
            "api_key": LASTFM_API_KEY,
            "sk": LASTFM_SESSION_KEY,
            "api_sig": api_sig,
            "format": "json"
        }
    )
    
    if response.status_code == 200:
        data = response.json()
        artists = []
        
        spotify_token = get_spotify_token()

        for artist in data['topartists']['artist']:
            image_url = None
            if spotify_token:
                # A failed image lookup must not kill the whole response.
                try:
                    spotify_search = requests.get(
                        "https://api.spotify.com/v1/search",
                        headers={"Authorization": f"Bearer {spotify_token}"},
                        params={
                            "q": artist['name'],
                            "type": "artist",
                            "limit": 1
                        }
                    )
                    if spotify_search.status_code == 200:
                        spotify_data = spotify_search.json()
                        if spotify_data['artists']['items']:
                            images = spotify_data['artists']['items'][0].get('images', [])
                            if images:
                                image_url = images[0]['url']  # Largest image
                except (requests.RequestException, ValueError, KeyError, IndexError):
                    pass
            
            artists.append({
                "name": artist['name'],
                "playcount": int(artist['playcount']),
                "url": artist['url'],
                "image": image_url
            })
        
        return jsonify({"artists": artists})

    return jsonify({"error": "Could not fetch data"}), 500


@app.route('/api/lastfm/recent-tracks')
def lastfm_recent_tracks():
    """Recent scrobbles for the paused-mode queue.

    The track list comes from Last.fm (always available regardless of Spotify
    player state, so the queue never gets stuck on 'Loading queue...'). Album
    thumbnails are looked up on Spotify per track so we never surface Last.fm's
    generic placeholder art. user.getrecenttracks is a public read method, so
    unlike user.gettopartists it needs no session key / signature.
    """
    response = requests.get(
        "http://ws.audioscrobbler.com/2.0/",
        params={
            "method": "user.getrecenttracks",
            "user": LASTFM_USER,
            "limit": 8,  # margin for dedupe + skipping the paused track; FE shows 4
            "api_key": LASTFM_API_KEY,
            "format": "json",
        }
    )

    if response.status_code != 200:
        return jsonify({"tracks": []})

    data = response.json()
    spotify_token = get_spotify_token()

    # Collect candidate scrobbles first (skip Last.fm's now-playing pseudo-entry),
    # keeping each track's Last.fm art as a fallback.
    candidates = []
    for t in data.get('recenttracks', {}).get('track', []):
        if t.get('@attr', {}).get('nowplaying') == 'true':
            continue
        lastfm_imgs = {img['size']: img['#text'] for img in t.get('image', [])}
        candidates.append({
            "track_name": t['name'],
            "artist_name": t['artist']['#text'],
            "lastfm_image": lastfm_imgs.get('medium') or lastfm_imgs.get('large') or '',
        })

    def resolve_image(c):
        """Look up a small album-art URL on Spotify, falling back to Last.fm art."""
        if spotify_token:
            try:
                search = requests.get(
                    "https://api.spotify.com/v1/search",
                    headers={"Authorization": f"Bearer {spotify_token}"},
                    params={"q": f"{c['track_name']} {c['artist_name']}", "type": "track", "limit": 1},
                    timeout=5,
                )
                if search.status_code == 200:
                    items = search.json().get('tracks', {}).get('items', [])
                    if items:
                        images = items[0]['album'].get('images', [])
                        if images:
                            return images[-1]['url']  # smallest = 64x64 thumb
            except (requests.RequestException, ValueError, KeyError, IndexError):
                pass
        return c["lastfm_image"]

    # Resolve thumbnails concurrently so a paused-queue refresh costs one round-trip
    # of latency instead of one Spotify search per track.
    with ThreadPoolExecutor(max_workers=8) as pool:
        images = pool.map(resolve_image, candidates)

    tracks = []
    for c, album_image in zip(candidates, images):
        # Never emit a track without real art (no stubs).
        if not album_image:
            continue
        tracks.append({
            "track_name": c["track_name"],
            "artist_name": c["artist_name"],
            "album_image": album_image,
        })

    return jsonify({"tracks": tracks})

# LETTERBOXD ENDPOINTS

@app.route('/api/letterboxd/recent')
def letterboxd_recent():
    """Get 4 most recent watched films"""
    feed = feedparser.parse(f"https://letterboxd.com/{LETTERBOXD_USER}/rss/")
    
    films = []
    for entry in feed.entries[:4]:
        rating = entry.get('letterboxd_memberrating', None)

        films.append({
            "title": entry.letterboxd_filmtitle,
            "year": entry.letterboxd_filmyear,
            "rating": float(rating) if rating else None,
            "watched_date": entry.letterboxd_watcheddate,
            "url": entry.link,
            "tmdb_id": entry.tmdb_movieid,
            "poster": extract_poster_from_summary(entry.summary)
        })
    
    return jsonify({"films": films})

@app.route('/api/letterboxd/top4')
def letterboxd_top4():
    """Get top 4 favorite films (hardcoded)"""
    with open('top4.json', 'r') as f:
        films = json.load(f)
    return jsonify({"films": films})

def extract_poster_from_summary(summary):
    """Extract poster URL from Letterboxd RSS summary HTML"""
    # Summary contains: <img src="https://a.ltrbxd.com/resized/film-poster/..." />
    match = re.search(r'src="([^"]+)"', summary)
    return match.group(1) if match else None

# RUN SERVER

if __name__ == '__main__':
    print("Starting server on http://0.0.0.0:5000")
    app.run(host='0.0.0.0', port=5000, debug=True)