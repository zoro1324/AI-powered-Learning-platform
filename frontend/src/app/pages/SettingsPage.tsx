import { useState } from 'react';
import { Sidebar } from '../components/Sidebar';
import { User, Bell, Lock, Palette, Globe, Headphones } from 'lucide-react';

export default function SettingsPage() {
  const [notifications, setNotifications] = useState({
    email: true,
    push: true,
    courseUpdates: false,
  });

  const [podcastPreferences, setPodcastPreferences] = useState({
    enabled: true,
    autoGenerate: false,
  });

  const [profile, setProfile] = useState({
    name: 'John Doe',
    email: 'john.doe@example.com',
    language: 'English',
    theme: 'Light',
  });

  const navItems = [
    { icon: User, label: 'Profile' },
    { icon: Bell, label: 'Notifications' },
    { icon: Lock, label: 'Security' },
    { icon: Palette, label: 'Appearance' },
    { icon: Globe, label: 'Language' },
  ];

  return (
    <div className="app-shell">
      <Sidebar />
      
      <main className="app-main">
        <div className="app-content">
          <div className="mb-8">
            <p className="text-xs uppercase tracking-[0.14em] text-neutral-500 mb-2">Preferences Center</p>
            <h1 className="text-4xl font-semibold text-neutral-900 mb-2">Settings</h1>
            <p className="text-neutral-600 text-lg">Manage your account and preferences</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1">
              <div className="surface-card p-4 sticky top-8">
                <nav className="space-y-1">
                  {navItems.map((item, idx) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={idx}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                          idx === 0
                            ? 'bg-neutral-900 text-white'
                            : 'text-neutral-600 hover:bg-neutral-100'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                        <span className="font-medium">{item.label}</span>
                      </button>
                    );
                  })}
                </nav>
              </div>
            </div>

            <div className="lg:col-span-2 space-y-8">
              <div className="surface-card p-8">
                <div className="flex items-center gap-4 mb-8">
                  <User className="w-6 h-6 text-neutral-900" />
                  <h2 className="text-2xl font-semibold text-neutral-900">Profile Settings</h2>
                </div>

                <div className="space-y-6">
                  {/* Profile Picture */}
                  <div className="flex items-center gap-6">
                    <div className="w-20 h-20 bg-neutral-900 rounded-full flex items-center justify-center text-white text-2xl font-semibold">
                      JD
                    </div>
                    <div>
                      <button className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-all mb-2">
                        Change Photo
                      </button>
                      <p className="text-sm text-neutral-600">JPG, PNG or GIF. Max size 2MB</p>
                    </div>
                  </div>

                  {/* Name */}
                  <div>
                    <label htmlFor="full-name" className="block text-sm font-medium text-neutral-700 mb-2">Full Name</label>
                    <input
                      id="full-name"
                      type="text"
                      value={profile.name}
                      onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-neutral-500 focus:border-transparent"
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <label htmlFor="email-address" className="block text-sm font-medium text-neutral-700 mb-2">Email Address</label>
                    <input
                      id="email-address"
                      type="email"
                      value={profile.email}
                      onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-neutral-500 focus:border-transparent"
                    />
                  </div>

                  {/* Bio */}
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">Bio</label>
                    <textarea
                      rows={4}
                      placeholder="Tell us about yourself..."
                      className="w-full px-4 py-3 rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-neutral-500 focus:border-transparent"
                    />
                  </div>

                  <button className="w-full py-3 bg-neutral-900 text-white rounded-xl font-medium hover:bg-neutral-800 transition-all">
                    Save Changes
                  </button>
                </div>
              </div>

              <div className="surface-card p-8">
                <div className="flex items-center gap-4 mb-8">
                  <Bell className="w-6 h-6 text-neutral-900" />
                  <h2 className="text-2xl font-semibold text-neutral-900">Notification Preferences</h2>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between py-4 border-b border-neutral-200">
                    <div>
                      <p className="font-medium text-neutral-900">Email Notifications</p>
                      <p className="text-sm text-neutral-600">Receive notifications via email</p>
                    </div>
                    <button
                      onClick={() => setNotifications({ ...notifications, email: !notifications.email })}
                      aria-label="Toggle email notifications"
                      className={`relative w-12 h-6 rounded-full transition-all ${
                        notifications.email ? 'bg-blue-500' : 'bg-gray-300'
                      }`}
                    >
                      <div
                        className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-all ${
                          notifications.email ? 'translate-x-6' : ''
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between py-4 border-b border-neutral-200">
                    <div>
                      <p className="font-medium text-neutral-900">Push Notifications</p>
                      <p className="text-sm text-neutral-600">Receive push notifications in browser</p>
                    </div>
                    <button
                      onClick={() => setNotifications({ ...notifications, push: !notifications.push })}
                      aria-label="Toggle push notifications"
                      className={`relative w-12 h-6 rounded-full transition-all ${
                        notifications.push ? 'bg-blue-500' : 'bg-gray-300'
                      }`}
                    >
                      <div
                        className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-all ${
                          notifications.push ? 'translate-x-6' : ''
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between py-4">
                    <div>
                      <p className="font-medium text-neutral-900">Course Updates</p>
                      <p className="text-sm text-neutral-600">Get notified about new course content</p>
                    </div>
                    <button
                      onClick={() => setNotifications({ ...notifications, courseUpdates: !notifications.courseUpdates })}
                      aria-label="Toggle course update notifications"
                      className={`relative w-12 h-6 rounded-full transition-all ${
                        notifications.courseUpdates ? 'bg-blue-500' : 'bg-gray-300'
                      }`}
                    >
                      <div
                        className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-all ${
                          notifications.courseUpdates ? 'translate-x-6' : ''
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>

              <div className="surface-card p-8">
                <div className="flex items-center gap-4 mb-8">
                  <Headphones className="w-6 h-6 text-neutral-900" />
                  <h2 className="text-2xl font-semibold text-neutral-900">Podcast Preferences</h2>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between py-4 border-b border-neutral-200">
                    <div>
                      <p className="font-medium text-neutral-900">Enable Audio Podcasts</p>
                      <p className="text-sm text-neutral-600">Generate audio conversations from course content</p>
                    </div>
                    <button
                      onClick={() => setPodcastPreferences({ ...podcastPreferences, enabled: !podcastPreferences.enabled })}
                      aria-label="Toggle audio podcasts"
                      className={`relative w-12 h-6 rounded-full transition-all ${
                        podcastPreferences.enabled ? 'bg-blue-500' : 'bg-gray-300'
                      }`}
                    >
                      <div
                        className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-all ${
                          podcastPreferences.enabled ? 'translate-x-6' : ''
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between py-4">
                    <div>
                      <p className="font-medium text-neutral-900">Auto-Generate Podcasts</p>
                      <p className="text-sm text-neutral-600">Automatically create podcasts for new topics</p>
                    </div>
                    <button
                      onClick={() => setPodcastPreferences({ ...podcastPreferences, autoGenerate: !podcastPreferences.autoGenerate })}
                      disabled={!podcastPreferences.enabled}
                      aria-label="Toggle auto-generate podcasts"
                      className={`relative w-12 h-6 rounded-full transition-all ${
                        podcastPreferences.autoGenerate && podcastPreferences.enabled ? 'bg-blue-500' : 'bg-gray-300'
                      } ${!podcastPreferences.enabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <div
                        className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-all ${
                          podcastPreferences.autoGenerate && podcastPreferences.enabled ? 'translate-x-6' : ''
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>

              <div className="surface-card p-8">
                <div className="flex items-center gap-4 mb-8">
                  <Lock className="w-6 h-6 text-neutral-900" />
                  <h2 className="text-2xl font-semibold text-neutral-900">Security</h2>
                </div>

                <div className="space-y-4">
                  <button className="w-full text-left px-6 py-4 border border-neutral-200 rounded-xl hover:bg-neutral-50 transition-all">
                    <p className="font-medium text-neutral-900 mb-1">Change Password</p>
                    <p className="text-sm text-neutral-600">Update your password regularly</p>
                  </button>

                  <button className="w-full text-left px-6 py-4 border border-neutral-200 rounded-xl hover:bg-neutral-50 transition-all">
                    <p className="font-medium text-neutral-900 mb-1">Two-Factor Authentication</p>
                    <p className="text-sm text-neutral-600">Add an extra layer of security</p>
                  </button>

                  <button className="w-full text-left px-6 py-4 border border-neutral-200 rounded-xl hover:bg-neutral-50 transition-all">
                    <p className="font-medium text-neutral-900 mb-1">Connected Devices</p>
                    <p className="text-sm text-neutral-600">Manage devices with access to your account</p>
                  </button>
                </div>
              </div>

              {/* Danger Zone */}
              <div className="bg-red-50 border border-red-200 rounded-2xl p-8">
                <h3 className="text-xl font-semibold text-red-900 mb-4">Danger Zone</h3>
                <p className="text-red-700 mb-4">Once you delete your account, there is no going back. Please be certain.</p>
                <button className="px-6 py-3 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-all">
                  Delete Account
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
