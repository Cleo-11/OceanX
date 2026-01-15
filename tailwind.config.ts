import type { Config } from "tailwindcss";

const config: Config = {
		darkMode: ["class"],
			 safelist: [
				// Core body/layout classes to prevent purge removal
				'min-h-screen', 'bg-depth-950', 'font-sans', 'antialiased',
				// Design system classes
				'ocean-home', 'container-ocean', 'grid-main', 'section-gap',
				'card-base', 'card-glass', 'card-elevated',
				'btn-primary', 'btn-secondary', 'btn-hero',
				'heading-hero', 'heading-section', 'heading-card',
				'text-body', 'text-caption', 'text-overline', 'text-mono',
				'status-pill', 'status-indicator', 'status-bar',
				'progress-bar', 'progress-bar-fill',
				'stats-grid', 'stat-item', 'stat-icon', 'stat-value', 'stat-label',
				'submarine-card', 'submarine-icon-wrapper',
				'captains-log', 'captains-log-header', 'captains-log-entry', 'captains-log-cursor',
				'leaderboard-row', 'rank-badge', 'rank-badge-gold', 'rank-badge-silver', 'rank-badge-bronze',
				'ocx-amount', 'skeleton', 'interactive', 'depth-gradient', 'ocean-glow',
			// For AnimatedFish and Seaweed dynamic color classes
			'bg-cyan-500/40', 'bg-cyan-400/70', 'bg-cyan-300/40',
			'bg-blue-500/40', 'bg-blue-400/70', 'bg-blue-300/40',
			'bg-teal-500/40', 'bg-teal-400/70', 'bg-teal-300/40',
			'bg-green-500/40', 'bg-green-400/70', 'bg-green-300/40',
			'bg-emerald-500/40', 'bg-emerald-400/70', 'bg-emerald-300/40',
			'bg-cyan-600/40', 'bg-cyan-400/30', 'bg-cyan-400/20',
			'bg-blue-600/40', 'bg-blue-400/30', 'bg-blue-400/20',
			'bg-teal-600/40', 'bg-teal-400/30', 'bg-teal-400/20',
			'bg-green-600/40', 'bg-green-400/30', 'bg-green-400/20',
			'bg-emerald-600/40', 'bg-emerald-400/30', 'bg-emerald-400/20',
		],
	    // NOTE: Removed root-level wildcard to avoid scanning node_modules / build output.
	    // If you add new directories with JSX/TSX, include them explicitly here.
	    content: [
	    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
	    "./components/**/*.{js,ts,jsx,tsx,mdx}",
	    "./app/**/*.{js,ts,jsx,tsx,mdx}",
	    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
	  ],
  theme: {
		 extend: {
				keyframes: {
					shimmer: {
						'0%': { backgroundPosition: '-200% 0' },
						'100%': { backgroundPosition: '200% 0' },
					},
					float: {
						'0%, 100%': { transform: 'translateY(0)' },
						'50%': { transform: 'translateY(-10px)' },
					},
					ping: {
						'75%, 100%': { transform: 'scale(2)', opacity: '0' },
					},
					glow: {
						'0%, 100%': { boxShadow: '0 0 12px 2px rgba(56, 189, 248, 0.5)' },
						'50%': { boxShadow: '0 0 24px 4px rgba(56, 189, 248, 0.9)' },
					},
					spinSlow: {
						'0%': { transform: 'rotate(0deg)' },
						'100%': { transform: 'rotate(360deg)' },
					},
					'accordion-down': {
						from: {
							height: '0'
						},
						to: {
							height: 'var(--radix-accordion-content-height)'
						}
					},
					'accordion-up': {
						from: {
							height: 'var(--radix-accordion-content-height)'
						},
						to: {
							height: '0'
						}
					}
				},
				animation: {
					'accordion-down': 'accordion-down 0.2s ease-out',
					'accordion-up': 'accordion-up 0.2s ease-out',
					shimmer: 'shimmer 4s linear infinite',
					float: 'float 4s ease-in-out infinite',
					'float-slow': 'float 6s ease-in-out infinite',
					'float-medium': 'float 4s ease-in-out infinite',
					'float-fast': 'float 3s ease-in-out infinite',
					glow: 'glow 2s ease-in-out infinite',
					spinSlow: 'spinSlow 8s linear infinite',
				},
				animationDelay: {
					'0': '0ms',
					'75': '75ms',
					'100': '100ms',
					'150': '150ms',
					'200': '200ms',
					'300': '300ms',
					'500': '500ms',
					'700': '700ms',
					'1000': '1000ms',
					'2000': '2000ms',
				},
				boxShadow: {
					'glow': '0 0 16px 2px rgba(56, 189, 248, 0.7)',
					'glow-strong': '0 0 24px 4px rgba(56, 189, 248, 0.9)',
					'inner-glow': 'inset 0 2px 24px 0 rgba(172, 224, 255, 0.2)',
				},
				backgroundImage: {
				'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
				'shimmer': 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0.1), transparent)',
				'hexagon-pattern': `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M15 10h30l15 25.98L45 50H15L0 25.98L15 10z' fill='%2338bdf8' fill-opacity='0.05' fill-rule='evenodd'/%3E%3C/svg%3E")`,
				},
  		colors: {
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			},
  			// Custom semantic color palette for AbyssX
  			ocean: {
  				50: '#e6f7ff',
  				100: '#b3e5ff',
  				200: '#80d4ff',
  				300: '#4dc2ff',
  				400: '#1ab1ff',
  				500: '#0891b2', // Primary brand color
  				600: '#0e7490',
  				700: '#155e75',
  				800: '#164e63',
  				900: '#0c3544',
  				950: '#042f3e',
  			},
  			abyss: {
  				50: '#f0f9ff',
  				100: '#e0f2fe',
  				200: '#bae6fd',
  				300: '#7dd3fc',
  				400: '#38bdf8',
  				500: '#0ea5e9', // Accent color
  				600: '#0284c7',
  				700: '#0369a1',
  				800: '#075985',
  				900: '#0c4a6e',
  				950: '#082f49',
  			},
  			depth: {
  				50: '#f8fafc',
  				100: '#f1f5f9',
  				200: '#e2e8f0',
  				300: '#cbd5e1',
  				400: '#94a3b8',
  				500: '#64748b',
  				600: '#475569',
  				700: '#334155',
  				800: '#1e293b',
  				900: '#0f172a', // Dark UI backgrounds
  				950: '#020617',
  			}
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  	}
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
