/**
 * Evento e sua conversa.
 *
 * Comentários com uma camada de resposta. Duas já seriam uma árvore, e árvore em tela de
 * celular vira labirinto — uma camada cobre a conversa real sem custar legibilidade.
 */

import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { api, type FeedEvent } from '../../../src/api.ts';
import { Avatar, Divider, Field, Loading, Panel, Pill, Screen, Txt, Button, ErrorState } from '../../../src/ui.tsx';
import { ReactionControl, type ReactionKind } from '../../../src/components/ReactionControl.tsx';
import { color, radius, space, timeAgo } from '../../../src/theme.ts';

interface CommentAuthor {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
}

interface CommentNode {
  id: string;
  body: string;
  createdAt: string;
  author: CommentAuthor;
  replies?: CommentNode[];
}

const EVENT_LABEL: Record<string, string> = {
  UPGRADE: 'Upgrade',
  BUILD: 'Montagem',
  BENCHMARK: 'Benchmark',
  MAINTENANCE: 'Manutenção',
  PURCHASE: 'Compra',
  SALE: 'Venda',
  SETUP: 'Setup',
  ACHIEVEMENT: 'Conquista',
  MILESTONE: 'Marco',
  DISCUSSION: 'Discussão',
};

function Comment({ comment, onReply }: { comment: CommentNode; onReply: (id: string, name: string) => void }) {
  const router = useRouter();
  return (
    <View style={{ gap: space.sm }}>
      <View style={{ flexDirection: 'row', gap: space.md }}>
        <Pressable onPress={() => router.push(`/profile?handle=${comment.author.handle}`)}>
          <Avatar name={comment.author.displayName} size={30} />
        </Pressable>
        <View style={{ flex: 1, gap: 3 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Txt variant="smallStrong">{comment.author.displayName}</Txt>
            <Txt variant="small" tone="faint">
              {timeAgo(comment.createdAt)}
            </Txt>
          </View>
          <Txt variant="body" tone="dim">
            {comment.body}
          </Txt>
          <Pressable onPress={() => onReply(comment.id, comment.author.displayName)} hitSlop={8}>
            <Txt variant="small" tone="faint">
              Responder
            </Txt>
          </Pressable>
        </View>
      </View>

      {comment.replies && comment.replies.length > 0 ? (
        <View style={{ paddingLeft: 30 + space.md, gap: space.md, marginTop: space.xs }}>
          {comment.replies.map((reply) => (
            <View key={reply.id} style={{ flexDirection: 'row', gap: space.md }}>
              <Avatar name={reply.author.displayName} size={24} />
              <View style={{ flex: 1, gap: 3 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Txt variant="smallStrong">{reply.author.displayName}</Txt>
                  <Txt variant="small" tone="faint">
                    {timeAgo(reply.createdAt)}
                  </Txt>
                </View>
                <Txt variant="body" tone="dim">
                  {reply.body}
                </Txt>
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export default function EventDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);

  const event = useQuery({
    queryKey: ['event', id],
    queryFn: () => api.get<{ event: FeedEvent }>(`/events/${id}`),
  });

  const comments = useQuery({
    queryKey: ['comments', id],
    queryFn: () => api.get<{ comments: CommentNode[] }>(`/events/${id}/comments`),
  });

  const react = useMutation({
    mutationFn: (kind: ReactionKind | null) =>
      kind ? api.put(`/events/${id}/reaction`, { kind }) : api.del(`/events/${id}/reaction`),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['event', id] });
      void queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });

  const send = useMutation({
    mutationFn: () => api.post(`/events/${id}/comments`, { body: draft.trim(), parentId: replyTo?.id ?? null }),
    onSuccess: () => {
      setDraft('');
      setReplyTo(null);
      void queryClient.invalidateQueries({ queryKey: ['comments', id] });
      void queryClient.invalidateQueries({ queryKey: ['event', id] });
      void queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });

  if (event.isLoading) return <Loading />;
  if (event.error || !event.data) {
    return (
      <Screen scroll>
        <ErrorState
          message={(event.error as Error)?.message ?? 'Evento não encontrado.'}
          onRetry={() => void event.refetch()}
        />
      </Screen>
    );
  }

  const data = event.data.event;
  const payload = data.payload as { from?: string; to?: string; scoreDelta?: number } | null;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen scroll>
        <View style={{ paddingTop: space.md, paddingBottom: space.lg }}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Txt variant="smallStrong" tone="faint">
              ← Voltar
            </Txt>
          </Pressable>
        </View>

        <Animated.View entering={FadeIn.duration(280)} style={{ gap: space.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <Pressable onPress={() => router.push(`/profile?handle=${data.author.handle}`)}>
              <Avatar name={data.author.displayName} size={40} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Txt variant="bodyStrong">{data.author.displayName}</Txt>
              <Txt variant="small" tone="faint">
                {EVENT_LABEL[data.kind] ?? data.kind} · {timeAgo(data.createdAt)}
              </Txt>
            </View>
          </View>

          <Txt variant="heading" style={{ lineHeight: 27 }}>
            {data.title}
          </Txt>

          {data.body ? (
            <Txt variant="body" tone="dim">
              {data.body}
            </Txt>
          ) : null}

          {payload?.from && payload?.to ? (
            <Panel style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              <View style={{ flex: 1 }}>
                <Txt variant="small" tone="faint" numberOfLines={1}>
                  {payload.from}
                </Txt>
              </View>
              <Txt variant="small" tone="accent">
                →
              </Txt>
              <View style={{ flex: 1 }}>
                <Txt variant="smallStrong" numberOfLines={1}>
                  {payload.to}
                </Txt>
              </View>
              {typeof payload.scoreDelta === 'number' && payload.scoreDelta !== 0 ? (
                <Pill
                  label={`${payload.scoreDelta > 0 ? '+' : ''}${payload.scoreDelta}`}
                  tint={payload.scoreDelta > 0 ? color.good : color.textDim}
                />
              ) : null}
            </Panel>
          ) : null}

          {data.rig ? (
            <Pressable onPress={() => router.push(`/rigs/${data.rig!.id}`)} hitSlop={6}>
              <Txt variant="smallStrong" tone="accent">
                Ver a máquina: {data.rig.name}
              </Txt>
            </Pressable>
          ) : null}

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xl }}>
            <ReactionControl
              current={data.viewerReaction}
              counts={data.reactions}
              onReact={(kind) => react.mutate(kind)}
              onClear={() => react.mutate(null)}
            />
            <Txt variant="smallStrong" tone="faint">
              {data.commentCount} {data.commentCount === 1 ? 'comentário' : 'comentários'}
            </Txt>
          </View>
        </Animated.View>

        <Divider style={{ marginVertical: space.xl }} />

        {comments.isLoading ? (
          <Loading />
        ) : comments.data && comments.data.comments.length > 0 ? (
          <View style={{ gap: space.xl }}>
            {comments.data.comments.map((comment, index) => (
              <Animated.View key={comment.id} entering={FadeInDown.delay(index * 45).duration(280)}>
                <Comment comment={comment} onReply={(cid, name) => setReplyTo({ id: cid, name })} />
              </Animated.View>
            ))}
          </View>
        ) : (
          <Txt variant="small" tone="faint" style={{ textAlign: 'center', paddingVertical: space.xl }}>
            Nenhum comentário ainda. Seja o primeiro.
          </Txt>
        )}

        {/* Caixa de resposta */}
        <View style={{ marginTop: space.xxl, gap: space.sm }}>
          {replyTo ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <Txt variant="small" tone="faint" style={{ flex: 1 }}>
                Respondendo a {replyTo.name}
              </Txt>
              <Pressable onPress={() => setReplyTo(null)} hitSlop={8}>
                <Txt variant="small" tone="accent">
                  cancelar
                </Txt>
              </Pressable>
            </View>
          ) : null}

          <Field
            placeholder={replyTo ? 'Sua resposta...' : 'Escreva um comentário...'}
            value={draft}
            onChangeText={setDraft}
            multiline
            style={{ minHeight: 46, maxHeight: 120, borderRadius: radius.md }}
          />

          <Button
            label="Enviar"
            size="sm"
            disabled={draft.trim().length === 0}
            loading={send.isPending}
            onPress={() => send.mutate()}
          />
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}
