import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { m as motion } from "motion/react";
import {
  ArrowLeft,
  Bell,
  MessageCircle,
  Reply,
  AtSign,
  Hash,
  Volume2,
  VolumeX,
  Loader2,
  Check,
} from "lucide-react";
import toast from "react-hot-toast";
import settingsService from "../services/settingsService";

const preferenceGroups = [
  {
    title: "Messages",
    description: "Choose which conversations can notify you.",
    items: [
      {
        key: "directMessages",
        title: "Direct messages",
        description: "When someone sends you a direct message.",
        icon: MessageCircle,
      },
      {
        key: "replies",
        title: "Replies",
        description: "When someone replies to your messages.",
        icon: Reply,
      },
      {
        key: "mentions",
        title: "Mentions",
        description: "When someone mentions you in a conversation.",
        icon: AtSign,
      },
      {
        key: "channelMessages",
        title: "Channel messages",
        description: "Notifications for new channel messages.",
        icon: Hash,
      },
    ],
  },
  {
    title: "Sound",
    description: "Control notification audio.",
    items: [
      {
        key: "sound",
        title: "Notification sound",
        description: "Play a subtle sound when a new notification arrives.",
        icon: Volume2,
      },
    ],
  },
];

function PreferenceSwitch({ enabled, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label="Toggle notification preference"
      disabled={disabled}
      onClick={onChange}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200 disabled:opacity-50 ${
        enabled ? "bg-indigo-600" : "bg-[var(--border)]"
      }`}
    >
      <motion.span
        animate={{ x: enabled ? 22 : 3 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className="absolute left-0 top-[3px] h-[22px] w-[22px] rounded-full bg-white shadow"
      />
    </button>
  );
}

export default function SettingsPage() {
  const navigate = useNavigate();

  const [preferences, setPreferences] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState("");

  useEffect(() => {
    let active = true;

    settingsService
      .getNotificationPreferences()
      .then((data) => {
        if (!active) return;

        setPreferences(data);
        localStorage.setItem(
          "cirql-notification-preferences",
          JSON.stringify(data)
        );
      })
      .catch((error) => {
        if (active) {
          toast.error(
            error.response?.data?.message ||
              "Could not load notification settings"
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const handleToggle = async (key) => {
    if (!preferences || savingKey) return;

    const previousValue = preferences[key];
    const nextValue = !previousValue;

    setPreferences((current) => ({
      ...current,
      [key]: nextValue,
    }));

    setSavingKey(key);

    try {
      const updated = await settingsService.updateNotificationPreferences({
        [key]: nextValue,
      });

      setPreferences(updated);
      localStorage.setItem(
        "cirql-notification-preferences",
        JSON.stringify(updated)
      );

      toast.success("Preference saved", { duration: 1500 });
    } catch (error) {
      setPreferences((current) => ({
        ...current,
        [key]: previousValue,
      }));

      toast.error(
        error.response?.data?.message || "Could not save preference"
      );
    } finally {
      setSavingKey("");
    }
  };

  return (
    <div className="min-h-dvh overflow-y-auto bg-[var(--bg)] text-[var(--text)]">
      <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8 sm:py-12">
        <motion.button
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={() => navigate("/")}
          className="mb-9 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-[var(--muted)] transition hover:bg-[var(--surface)] hover:text-[var(--text)]"
        >
          <ArrowLeft size={17} />
          Back to CIRQL
        </motion.button>

        <motion.header
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-9"
        >
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-500">
            <Bell size={27} />
          </div>

          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Settings
          </h1>

          <p className="mt-2 text-sm text-[var(--muted)] sm:text-base">
            Manage how and when CIRQL notifies you.
          </p>
        </motion.header>

        <div className="space-y-7">
          {preferenceGroups.map((group, groupIndex) => (
            <motion.section
              key={group.title}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: groupIndex * 0.1, duration: 0.3 }}
              className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]"
            >
              <div className="border-b border-[var(--border)] px-5 py-5 sm:px-6">
                <h2 className="font-semibold">{group.title}</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {group.description}
                </p>
              </div>

              <div className="divide-y divide-[var(--border)]">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const enabled = preferences?.[item.key] ?? true;
                  const saving = savingKey === item.key;

                  return (
                    <div
                      key={item.key}
                      className="flex items-center gap-4 px-5 py-5 sm:px-6"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500">
                        <Icon size={19} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-semibold">
                          {item.title}
                        </h3>
                        <p className="mt-1 text-xs leading-relaxed text-[var(--muted)] sm:text-sm">
                          {item.description}
                        </p>
                      </div>

                      {saving && (
                        <Loader2
                          size={16}
                          className="shrink-0 animate-spin text-indigo-500"
                        />
                      )}

                      <PreferenceSwitch
                        enabled={enabled}
                        disabled={loading || Boolean(savingKey)}
                        onChange={() => handleToggle(item.key)}
                      />
                    </div>
                  );
                })}
              </div>
            </motion.section>
          ))}
        </div>

        <div className="mt-6 flex items-center gap-2 text-xs text-[var(--muted)]">
          <Check size={15} className="text-emerald-500" />
          Your preferences are saved to your account.
        </div>

        <div className="mt-8 flex items-center gap-2 text-xs text-[var(--muted)]">
          <VolumeX size={15} />
          Workspace invitations remain enabled.
        </div>

        {loading && (
          <div className="mt-5 flex items-center gap-2 text-sm text-[var(--muted)]">
            <Loader2 size={16} className="animate-spin" />
            Loading preferences...
          </div>
        )}
      </div>
    </div>
  );
}
