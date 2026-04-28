import { useEffect, useState } from 'react';
import { supabase } from '../../services/supabaseClient';
import { useAuth } from '../../context/AuthContext';

const DEFAULT_PREFERENCES = {
  max_distance_km: 5,
  avoid_parks: false,
  avoid_narrow_paths: false,
  prefer_lit_areas: true,
  safety_priority: 'balanced',
};

export default function PreferencesPanel({ onPreferencesLoaded }) {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!user) return;

    async function loadPreferences() {
      const { data, error } = await supabase
        .from('profiles')
        .select('preferences')
        .eq('id', user.id)
        .single();

      if (!error && data?.preferences) {
        const prefs = { ...DEFAULT_PREFERENCES, ...data.preferences };
        setPreferences(prefs);
        onPreferencesLoaded?.(prefs);
      }
    }

    loadPreferences();
  }, [user]);

  async function savePreferences() {
    if (!user) return;
    setSaving(true);

    const { error } = await supabase
      .from('profiles')
      .update({ preferences })
      .eq('id', user.id);

    setSaving(false);

    if (!error) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onPreferencesLoaded?.(preferences);
    }
  }

  function updatePref(key, value) {
    setPreferences((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="border border-border bg-white p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-semibold text-brand uppercase tracking-wider">Saved Defaults</h3>
        <button
          onClick={savePreferences}
          disabled={saving}
          className="text-xs font-semibold text-brand border border-brand px-3 py-1 hover:bg-brand hover:text-white transition-all duration-200 disabled:opacity-50"
        >
          {saving ? 'Saving...' : saved ? 'Saved' : 'Save'}
        </button>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-xs text-text-secondary">Default distance: {preferences.max_distance_km} km</label>
          <input
            type="range"
            min="1"
            max="15"
            step="0.5"
            value={preferences.max_distance_km}
            onChange={(e) => updatePref('max_distance_km', parseFloat(e.target.value))}
            className="w-full mt-1.5"
          />
        </div>

        <div>
          <label className="text-xs text-text-secondary block mb-1">Safety priority</label>
          <select
            value={preferences.safety_priority}
            onChange={(e) => updatePref('safety_priority', e.target.value)}
            className="input-field text-sm py-2"
          >
            <option value="maximum_safety">Maximum Safety</option>
            <option value="balanced">Balanced</option>
            <option value="efficiency_focused">Distance Focused</option>
          </select>
        </div>
      </div>
    </div>
  );
}
