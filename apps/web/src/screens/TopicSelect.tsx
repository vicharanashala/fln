import { api } from '../api';
import { useLoad } from '../hooks';
import { parseSheetRef, setLetter } from '../lib';

/**
 * Picks which worksheet to use: a curriculum level that has approved questions, or (until those exist) a topic
 * of the older question bank. Used by both the print and the mark screens, so they always offer the same choices.
 */
export function TopicSelect({ classId, value, set, onPick, onUnauthorized }: {
  classId: string; value: string | null; set: number; onPick: (value: string, set: number) => void; onUnauthorized: () => void;
}) {
  const levels = useLoad(() => api.classLevels(classId), `class-levels-${classId}`, onUnauthorized);
  const topics = useLoad(() => api.topics(classId), `topics-${classId}`, onUnauthorized);
  const ref = parseSheetRef(value);
  const withSheets = levels.data?.levels.filter(l => l.sets > 0) ?? [];
  const sets = ref?.levelNumber !== undefined
    ? levels.data?.levels.find(l => l.levelNumber === ref.levelNumber)?.sets ?? 1
    : topics.data?.topics.find(t => t.bankLevel === ref?.bankLevel)?.sets ?? 1;
  return (
    <div className="card row">
      <label>Level or topic
        <select value={value ?? ''} onChange={e => onPick(e.target.value, 0)}>
          {withSheets.length > 0 && (
            <optgroup label="Curriculum levels with approved questions">
              {withSheets.map(l => <option key={l.levelNumber} value={`L${l.levelNumber}`}>Level {l.levelNumber}: {l.title}</option>)}
            </optgroup>
          )}
          {(topics.data?.topics.length ?? 0) > 0 && (
            <optgroup label="Older question bank (not matched to levels)">
              {topics.data?.topics.map(t => <option key={t.bankLevel} value={`B${t.bankLevel}`}>{t.title}</option>)}
            </optgroup>
          )}
        </select>
      </label>
      <label>Sheet
        <select value={set} onChange={e => onPick(value ?? '', Number(e.target.value))}>
          {Array.from({ length: Math.max(1, sets) }, (_, i) => <option key={i} value={i}>Sheet {setLetter(i)}</option>)}
        </select>
      </label>
    </div>
  );
}
