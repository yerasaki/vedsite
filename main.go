package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math/rand"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"sync"
	"syscall"
	"time"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/charmbracelet/log"
	"github.com/charmbracelet/ssh"
	"github.com/charmbracelet/wish"
	"github.com/charmbracelet/wish/bubbletea"
)

var discordWebhook = os.Getenv("DISCORD_WEBHOOK")

type Shape struct {
	x, y   float64
	vx, vy float64
	form   int
	color  lipgloss.Color
}

var shapeChars = []string{"#", "@", "*", "+"}

var pageColors = []lipgloss.Color{
	lipgloss.Color("#cc0000"), // about
	lipgloss.Color("#663399"), // projects (rebeccapurple)
	lipgloss.Color("#D4A017"), // experience (mustard)
	lipgloss.Color("#069494"), // misc
}

type tickMsg time.Time

type model struct {
	width       int
	height      int
	shapes      []Shape
	currentPage string
	startTime   time.Time
	renderer    *lipgloss.Renderer
}

var (
	lastNotified = make(map[string]time.Time)
	scannerIPs   = make(map[string]time.Time)
	notifyMu     sync.Mutex
)

func notifyVisitor(s ssh.Session) {
	startTime := time.Now()
	ip := strings.Split(s.RemoteAddr().String(), ":")[0]

	// Wait for session to end to measure duration
	<-s.Context().Done()
	duration := time.Since(startTime)

	notifyMu.Lock()
	// Check if scanner IP is rate-limited (1 hour)
	if t, ok := scannerIPs[ip]; ok && time.Since(t) < time.Hour {
		notifyMu.Unlock()
		return
	}
	// Check if real user IP is rate-limited (1 minute)
	if duration >= 15*time.Second {
		if t, ok := lastNotified[ip]; ok && time.Since(t) < time.Minute {
			notifyMu.Unlock()
			return
		}
		lastNotified[ip] = time.Now()
	} else {
		scannerIPs[ip] = time.Now()
	}
	notifyMu.Unlock()

	// Get location and timezone from IP (with timeout)
	client := &http.Client{Timeout: 3 * time.Second}
	resp, err := client.Get("http://ip-api.com/json/" + ip)
	if err != nil {
		return
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)

	var geo struct {
		City     string `json:"city"`
		Country  string `json:"country"`
		Timezone string `json:"timezone"`
	}
	json.Unmarshal(body, &geo)

	location := "Unknown"
	if geo.City != "" && geo.Country != "" {
		location = fmt.Sprintf("%s, %s", geo.City, geo.Country)
	}

	// Format time in visitor's local timezone
	localTime := startTime
	if geo.Timezone != "" {
		if loc, err := time.LoadLocation(geo.Timezone); err == nil {
			localTime = startTime.In(loc)
		}
	}

	// Format duration
	durationStr := fmt.Sprintf("%.1fs", duration.Seconds())
	if duration >= time.Minute {
		durationStr = fmt.Sprintf("%dm %ds", int(duration.Minutes()), int(duration.Seconds())%60)
	}

	var msg string
	if duration < 15*time.Second {
		msg = fmt.Sprintf(`{"content": "🤖 **Scanner detected**\n**IP:** %s\n**Location:** %s\n**Connected:** %s\n**Time:** %s\n_Muted for 1 hour_"}`,
			ip, location, durationStr, localTime.Format("Jan 2 15:04:05 MST"))
	} else {
		msg = fmt.Sprintf(`{"content": "🖥️ **SSH Portfolio visitor!**\n**IP:** %s\n**Location:** %s\n**Connected:** %s\n**Time:** %s"}`,
			ip, location, durationStr, localTime.Format("Jan 2 15:04:05 MST"))
	}

	if resp, err := client.Post(discordWebhook, "application/json", bytes.NewBuffer([]byte(msg))); err != nil {
		log.Error("Discord webhook failed", "error", err)
	} else {
		resp.Body.Close()
	}
}

func initialModel(renderer *lipgloss.Renderer) model {
	shapes := make([]Shape, 4)
	for i := 0; i < 4; i++ {
		shapes[i] = Shape{
			x:     float64(rand.Intn(60) + 10),
			y:     float64(rand.Intn(15) + 3),
			vx:    float64(rand.Intn(3)-1) + 0.5, // {-0.5, 0.5, 1.5} — never zero
			vy:    float64(rand.Intn(3)-1) + 0.5,
			form:  i % len(shapeChars),
			color: pageColors[i],
		}
	}
	return model{
		width:       80,
		height:      24,
		shapes:      shapes,
		currentPage: "",
		startTime:   time.Now(),
		renderer:    renderer,
	}
}

func tickCmd() tea.Cmd {
	return tea.Tick(time.Millisecond*50, func(t time.Time) tea.Msg {
		return tickMsg(t)
	})
}

func (m model) Init() tea.Cmd {
	return tickCmd()
}

func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch msg.String() {
		case "q", "ctrl+c":
			return m, tea.Quit
		case "1":
			m.currentPage = "about"
		case "2":
			m.currentPage = "projects"
		case "3":
			m.currentPage = "experience"
		case "4":
			m.currentPage = "misc"
		case "b", "esc":
			m.currentPage = ""
		}
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
	case tickMsg:
		// 10-minute session timeout
		if time.Since(m.startTime) > 10*time.Minute {
			return m, tea.Quit
		}

		for i := range m.shapes {
			m.shapes[i].x += m.shapes[i].vx
			m.shapes[i].y += m.shapes[i].vy

			morphed := false

			if m.shapes[i].x <= 0 {
				m.shapes[i].x = 0
				m.shapes[i].vx *= -1
				morphed = true
			} else if m.shapes[i].x >= float64(m.width-5) {
				m.shapes[i].x = float64(m.width - 5)
				m.shapes[i].vx *= -1
				morphed = true
			}

			if m.shapes[i].y < 2 {
				m.shapes[i].y = 2
				m.shapes[i].vy *= -1
				morphed = true
			} else if m.shapes[i].y >= float64(m.height-3) {
				m.shapes[i].y = float64(m.height - 3)
				m.shapes[i].vy *= -1
				morphed = true
			}

			if morphed {
				m.shapes[i].form = (m.shapes[i].form + 1) % len(shapeChars)
			}
		}
		return m, tickCmd()
	}
	return m, nil
}

func (m model) View() string {
	if m.currentPage != "" {
		return m.renderPage()
	}
	return m.renderHome()
}

func (m model) renderHome() string {
	bgStyle := m.renderer.NewStyle().Foreground(lipgloss.Color("#3a3a3a"))

	lines := make([][]rune, m.height)
	bgText := "vedsite "
	for y := 0; y < m.height; y++ {
		line := make([]rune, m.width)
		for x := 0; x < m.width; x++ {
			charIdx := (x + y*3) % len(bgText)
			line[x] = rune(bgText[charIdx])
		}
		lines[y] = line
	}

	for _, shape := range m.shapes {
		sx := int(shape.x)
		sy := int(shape.y)
		char := shapeChars[shape.form]

		for dy := 0; dy < 3; dy++ {
			for dx := 0; dx < 5; dx++ {
				py := sy + dy
				px := sx + dx
				if py >= 0 && py < m.height && px >= 0 && px < m.width {
					lines[py][px] = rune(char[0])
				}
			}
		}
	}

	var output strings.Builder
	for y, line := range lines {
		for x, ch := range line {
			colored := false
			for _, shape := range m.shapes {
				sx, sy := int(shape.x), int(shape.y)
				if x >= sx && x < sx+5 && y >= sy && y < sy+3 {
					style := m.renderer.NewStyle().Foreground(shape.color).Bold(true)
					output.WriteString(style.Render(string(ch)))
					colored = true
					break
				}
			}
			if !colored {
				output.WriteString(bgStyle.Render(string(ch)))
			}
		}
		output.WriteString("\n")
	}

	footerStyle := m.renderer.NewStyle().
		Foreground(lipgloss.Color("#ffffff")).
		Background(lipgloss.Color("#1a1a1a")).
		Padding(0, 1)

	footer := footerStyle.Render("[1] about  [2] projects  [3] experience  [4] misc  [q] quit")
	output.WriteString("\n" + footer)

	return output.String()
}

func (m model) renderPage() string {
	var color lipgloss.Color
	var title string
	var content string

	switch m.currentPage {
	case "about":
		color = pageColors[0]
		title = "ABOUT ME"
		content = `
instead of writing an all-encompassing
description, i thought it'd be better
to show you instead.

► int. roller skating (hk 2016)
► neu club squash vice president
► first-gen cs student & mentor
► film, music, tv enthusiast
► synecdoche, ny; nujabes; atlanta

      visit vedsite.com/about
      for the full photo gallery`

	case "projects":
		color = pageColors[1]
		title = "PROJECTS"
		content = `
► SSH Portfolio
  terminal-accessible portfolio

► NEU SquashHub
  full-stack team management app

► Premier League Analysis
  selenium scraping & regression

► Sanguine Card Game
  turn-based strategy game

► Light-Em-All
  kruskal's algorithm puzzle

► Carbon Neutrality Sim
  drracket environmental game`

	case "experience":
		color = pageColors[2]
		title = "EXPERIENCE"
		content = `
Northeastern University
B.S. Computer Science, Minor in Math
Expected May 2028

─────────────────────────────────────

► Vice President | NEU Club Squash
  Sep 2024 – Present

► Program Alumni | Khoury FIRST
  Sep 2024 – Present

► Software Dev Intern | TalentHome
  Jun – Aug 2023 | Mumbai, India`

	case "misc":
		color = pageColors[3]
		title = "MISC"
		content = `
live api integrations:

♫ spotify now playing & queue
♫ last.fm top artists
◎ letterboxd recent & top 4
◎ strava stats (coming soon)

visit vedsite.com/misc to see
what i'm listening to & watching!`
	}

	dimStyle := m.renderer.NewStyle().Foreground(lipgloss.Color("#888888"))

	// Create a proper bordered box using lipgloss
	titleBox := m.renderer.NewStyle().
		Foreground(color).
		Bold(true).
		Render(title)

	contentBox := m.renderer.NewStyle().
		Foreground(color).
		Border(lipgloss.RoundedBorder()).
		BorderForeground(color).
		Padding(1, 2).
		Render(titleBox + "\n" + content)

	// Center the box in the terminal
	centered := m.renderer.NewStyle().
		Width(m.width).
		Height(m.height-2).
		Align(lipgloss.Center, lipgloss.Center).
		Render(contentBox)

	footer := dimStyle.Render("[b] back  [q] quit")
	footerCentered := m.renderer.NewStyle().Width(m.width).Align(lipgloss.Center).Render(footer)

	return centered + "\n" + footerCentered
}

func main() {
	host := "0.0.0.0"
	port := 22

	srv, err := wish.NewServer(
		wish.WithAddress(fmt.Sprintf("%s:%d", host, port)),
		wish.WithHostKeyPath(".ssh/host_ed25519"),
		wish.WithMiddleware(
			bubbletea.Middleware(func(s ssh.Session) (tea.Model, []tea.ProgramOption) {
				go notifyVisitor(s)
				renderer := bubbletea.MakeRenderer(s)
				return initialModel(renderer), []tea.ProgramOption{tea.WithAltScreen()}
			}),
		),
	)
	if err != nil {
		log.Error("Could not create server", "error", err)
		os.Exit(1)
	}

	done := make(chan os.Signal, 1)
	signal.Notify(done, os.Interrupt, syscall.SIGINT, syscall.SIGTERM)

	log.Info("Starting SSH server", "host", host, "port", port)
	go func() {
		if err := srv.ListenAndServe(); err != nil {
			log.Error("Server error", "error", err)
		}
	}()

	<-done
	log.Info("Shutting down...")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Error("Shutdown error", "error", err)
	}
}
