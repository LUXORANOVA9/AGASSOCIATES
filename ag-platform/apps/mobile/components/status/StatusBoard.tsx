import { View } from 'react-native';
import type { DbCaseStatus } from '@ag/types';
import { StatusButton } from './StatusButton';

interface StatusBoardProps {
    current: DbCaseStatus;
    onSelect: (next: DbCaseStatus) => void;
}

// Quick-status board for field executives. The labels are intentionally
// outcome-oriented ("Originals Collected") rather than mirroring the raw
// DB enum names — the mapping is local to this component so the wire
// schema can be expanded without renaming buttons.
//
// Until the SQL case_status enum is widened (follow-up to Phase 0), every
// outcome maps to one of the 5 existing values.

interface ButtonSpec {
    label: string;
    toStatus: DbCaseStatus;
}

const SPECS: ButtonSpec[] = [
    { label: 'Originals Collected', toStatus: 'In Progress' },
    { label: 'Cheque Deposited', toStatus: 'In Progress' },
    { label: 'At SRO', toStatus: 'In Progress' },
    { label: 'Registration Complete', toStatus: 'Completed' },
];

export function StatusBoard({ current, onSelect }: StatusBoardProps) {
    return (
        <View className="gap-3">
            {SPECS.map((s) => (
                <StatusButton
                    key={s.label}
                    label={s.label}
                    toStatus={s.toStatus}
                    active={s.toStatus === current}
                    onPress={() => onSelect(s.toStatus)}
                />
            ))}
        </View>
    );
}
