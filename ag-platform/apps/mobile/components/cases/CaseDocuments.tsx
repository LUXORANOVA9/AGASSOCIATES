import { Text, View } from 'react-native';
import type { DocumentRow } from '@ag/types';
import { EmptyState } from '../ui';

interface CaseDocumentsProps {
    documents: DocumentRow[];
}

export function CaseDocuments({ documents }: CaseDocumentsProps) {
    if (documents.length === 0) {
        return (
            <EmptyState
                title="No documents yet"
                message="Scanned documents will appear here."
            />
        );
    }
    return (
        <View className="gap-2">
            {documents.map((doc) => (
                <View
                    key={doc.id}
                    className="bg-white border border-slate-200 rounded-lg p-3"
                >
                    <Text className="text-sm font-medium text-slate-900" numberOfLines={1}>
                        {doc.storage_path.split('/').pop()}
                    </Text>
                    <Text className="text-xs text-slate-500 mt-1">
                        {doc.received_status} · {formatSize(doc.size_bytes)} · {new Date(doc.created_at).toLocaleString()}
                    </Text>
                </View>
            ))}
        </View>
    );
}

function formatSize(bytes: number | null): string {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
