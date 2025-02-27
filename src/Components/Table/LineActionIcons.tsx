import { ClipboardButton, IconButton, Modal, useTheme2 } from '@grafana/ui';
import React, { useCallback, useState } from 'react';
import { GrafanaTheme2 } from '@grafana/data';
import { css } from '@emotion/css';
import { useQueryContext } from 'Components/Table/Context/QueryContext';
import { testIds } from '../../services/testIds';
import { generateLogShortlink } from 'services/text';

export const getStyles = (theme: GrafanaTheme2, bgColor?: string) => ({
  clipboardButton: css({
    padding: 0,
    height: '100%',
    lineHeight: '1',
    width: '20px',
  }),
  inspectButton: css({
    display: 'inline-flex',
    verticalAlign: 'middle',
    margin: 0,
    overflow: 'hidden',
    borderRadius: '5px',
  }),
  iconWrapper: css({
    height: '35px',
    position: 'sticky',
    left: 0,
    display: 'flex',
    background: theme.colors.background.secondary,
    padding: `0 ${theme.spacing(0.5)}`,
    zIndex: 1,
    boxShadow: theme.shadows.z2,
  }),
  inspect: css({
    padding: '5px 3px',

    '&:hover': {
      color: theme.colors.text.link,
      cursor: 'pointer',
    },
  }),
});
export function LineActionIcons(props: { rowIndex: number; value: unknown }) {
  const theme = useTheme2();
  const styles = getStyles(theme);
  const { logsFrame, timeRange } = useQueryContext();
  const logId = logsFrame?.idField?.values[props.rowIndex];
  const lineValue = logsFrame?.bodyField.values[props.rowIndex];
  const [isInspecting, setIsInspecting] = useState(false);
  const getText = useCallback(() => {
    if (timeRange) {
      return generateLogShortlink('selectedLine', { id: logId, row: props.rowIndex }, timeRange);
    }
    return '';
  }, [logId, props.rowIndex, timeRange]);
  return (
    <>
      <div className={styles.iconWrapper}>
        <div className={styles.inspect}>
          <IconButton
            data-testid={testIds.table.inspectLine}
            className={styles.inspectButton}
            tooltip="View log line"
            variant="secondary"
            aria-label="View log line"
            tooltipPlacement="top"
            size="md"
            name="eye"
            onClick={() => setIsInspecting(true)}
            tabIndex={0}
          />
        </div>
        <div className={styles.inspect}>
          <ClipboardButton
            className={styles.clipboardButton}
            icon="share-alt"
            variant="secondary"
            fill="text"
            size="md"
            tooltip="Copy link to log line"
            tooltipPlacement="top"
            tabIndex={0}
            getText={getText}
          />
        </div>
      </div>
      <>
        {isInspecting && (
          <Modal onDismiss={() => setIsInspecting(false)} isOpen={true} title="Inspect value">
            <pre>{lineValue}</pre>
            <Modal.ButtonRow>
              <ClipboardButton icon="copy" getText={() => props.value as string}>
                Copy to Clipboard
              </ClipboardButton>
            </Modal.ButtonRow>
          </Modal>
        )}
      </>
    </>
  );
}
