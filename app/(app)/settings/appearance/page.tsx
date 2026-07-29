import { ThemePicker } from "./ThemePicker";

export default function AppearanceSettingsPage() {
  return (
    <div>
      <p className="mb-4 text-sm text-neutral-600 dark:text-neutral-400">
        Choose how LifeOS looks. &quot;System&quot; follows your OS setting automatically,
        including live changes.
      </p>
      <ThemePicker />
    </div>
  );
}
