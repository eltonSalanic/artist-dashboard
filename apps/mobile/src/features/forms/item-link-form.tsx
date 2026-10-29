import { useRef, useState } from 'react';
import { itemLinkInputSchema, type LinkParentKind } from '@artist/shared';
import { toUserMessage, useItemLinks, usePermissions } from '@artist/api-client';
import { TextInput } from '@/components/text-input';
import { PosterText } from '@/components/poster-text';
import { TextField } from '@/components/text-field';
import { useTokens } from '@/theme';
import { FormGate } from './form-gate';
import { FormScreen } from './form-screen';

export function ItemLinkForm({
  boardId,
  kind,
  parentId,
}: {
  boardId: string;
  kind: LinkParentKind;
  parentId: string;
}) {
  const tokens = useTokens();
  const { can } = usePermissions();
  const links = useItemLinks(boardId, kind, parentId);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [urlError, setUrlError] = useState('');
  const urlInput = useRef<TextInput>(null);

  const save = async () => {
    const parsed = itemLinkInputSchema.safeParse({ title, url });
    if (!parsed.success) {
      setUrlError(parsed.error.issues[0].message);
      urlInput.current?.focus();
      throw new Error('Invalid link');
    }
    setError('');
    setUrlError('');
    try {
      await links.add.mutateAsync(parsed.data);
    } catch (err) {
      setError(toUserMessage(err, 'Could not save the link. Try again.'));
      throw err;
    }
  };

  return (
    <FormGate
      allowed={can('link.add')}
      pending={false}
      missing={false}
      what="link"
    >
      <FormScreen
        title="Add a link"
        dirty={!!(title || url)}
        canSave
        saving={links.add.isPending}
        onSave={save}
      >
        <TextField
          label="Name (optional)"
          autoFocus
          maxLength={200}
          placeholder="Link name"
          value={title}
          onChangeText={setTitle}
          editable={!links.add.isPending}
          returnKeyType="next"
          onSubmitEditing={() => urlInput.current?.focus()}
        />
        <TextField
          label="URL (required)"
          ref={urlInput}
          maxLength={2048}
          keyboardType="url"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="url"
          returnKeyType="done"
          placeholder="Link"
          value={url}
          onChangeText={(value) => {
            setUrl(value);
            setUrlError('');
          }}
          editable={!links.add.isPending}
          error={urlError}
        />
        <PosterText variant="cardMeta" color={tokens.mutedForeground}>
          Your band can open this link. Access is controlled by the site you
          link to.
        </PosterText>
        {error && (
          <PosterText
            variant="cardMeta"
            color={tokens.destructive}
            accessibilityRole="alert"
            selectable
          >
            {error}
          </PosterText>
        )}
      </FormScreen>
    </FormGate>
  );
}
