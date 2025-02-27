import React, { ChangeEvent, KeyboardEvent } from 'react';
import { RegexIconButton, RegexInputValue } from './RegexIconButton';
import { Button, Field, Select, useStyles2 } from '@grafana/ui';
import { SearchInput } from '../Breakdowns/SearchInput';
import { testIds } from '../../../services/testIds';
import { css, cx } from '@emotion/css';
import { LineFilterCaseSensitivityButton } from './LineFilterCaseSensitivityButton';
import { GrafanaTheme2 } from '@grafana/data';
import { LineFilterCaseSensitive } from '../../../services/filterTypes';

export interface LineFilterEditorProps {
  exclusive: boolean;
  lineFilter: string;
  caseSensitive: boolean;
  regex: boolean;
  setExclusive: (exclusive: boolean) => void;
  onInputChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onCaseSensitiveToggle: (caseSensitive: LineFilterCaseSensitive) => void;
  onRegexToggle: (regex: RegexInputValue) => void;
  updateFilter: (lineFilter: string, debounced: boolean) => void;
  handleEnter: (e: KeyboardEvent<HTMLInputElement>, lineFilter: string) => void;
  onSubmitLineFilter?: () => void;
  onClearLineFilter?: () => void;
}

export function LineFilterEditor({
  exclusive,
  lineFilter,
  caseSensitive,
  setExclusive,
  regex,
  onInputChange,
  onCaseSensitiveToggle,
  onRegexToggle,
  handleEnter,
  onSubmitLineFilter,
  onClearLineFilter,
}: LineFilterEditorProps) {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.wrapper}>
      {!onSubmitLineFilter && (
        <Select
          prefix={null}
          className={styles.select}
          value={exclusive ? 'exclusive' : 'inclusive'}
          options={[
            {
              value: 'exclusive',
              label: 'Exclude',
            },
            {
              value: 'inclusive',
              label: 'Include',
            },
          ]}
          onChange={() => setExclusive(!exclusive)}
        />
      )}
      <Field className={styles.field}>
        <SearchInput
          data-testid={testIds.exploreServiceDetails.searchLogs}
          value={lineFilter}
          className={cx(onSubmitLineFilter ? styles.inputNoBorderRight : undefined, styles.input)}
          onChange={onInputChange}
          suffix={
            <span className={`${styles.suffix} input-suffix`}>
              <LineFilterCaseSensitivityButton
                caseSensitive={caseSensitive}
                onCaseSensitiveToggle={onCaseSensitiveToggle}
              />
              <RegexIconButton regex={regex} onRegexToggle={onRegexToggle} />
            </span>
          }
          prefix={null}
          placeholder="Search in log lines"
          onClear={onClearLineFilter}
          onKeyUp={(e) => handleEnter(e, lineFilter)}
        />
      </Field>
      {onSubmitLineFilter && (
        <span className={styles.buttonWrap}>
          <Button
            onClick={() => {
              setExclusive(false);
              onSubmitLineFilter();
            }}
            className={styles.includeButton}
            variant={'secondary'}
            fill={'outline'}
            disabled={!lineFilter}
          >
            Include
          </Button>
          <Button
            onClick={() => {
              setExclusive(true);
              onSubmitLineFilter();
            }}
            className={styles.excludeButton}
            variant={'secondary'}
            fill={'outline'}
            disabled={!lineFilter}
          >
            Exclude
          </Button>
        </span>
      )}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  inputNoBorderRight: css({
    input: {
      borderTopRightRadius: 0,
      borderBottomRightRadius: 0,
    },
  }),
  suffix: css({
    display: 'inline-flex',
    gap: theme.spacing(0.5),
  }),
  removeBtn: css({
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
  }),
  buttonWrap: css({
    display: 'flex',
    justifyContent: 'center',
  }),
  includeButton: css({
    borderLeft: 'none',
    borderRadius: 0,
    borderRight: 'none',
    '&[disabled]': {
      borderRight: 'none',
    },
  }),
  excludeButton: css({
    borderRadius: `0 ${theme.shape.radius.default} ${theme.shape.radius.default} 0`,
    borderLeft: 'none',
    '&[disabled]': {
      borderLeft: 'none',
    },
  }),
  submit: css({
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
  }),
  select: css({
    label: 'line-filter-exclusion',
    marginLeft: 0,
    paddingLeft: 0,
    height: 'auto',
    borderBottomRightRadius: '0',
    borderTopRightRadius: '0',
    borderRight: 'none',
    minHeight: '30px',
    width: '100px',
    maxWidth: '95px',
    outline: 'none',
  }),
  wrapper: css({
    display: 'flex',
    width: '100%',
    maxWidth: '600px',
  }),
  input: css({
    label: 'line-filter-input-wrapper',
    width: '100%',
    input: {
      borderTopLeftRadius: 0,
      borderBottomLeftRadius: 0,
    },
  }),
  exclusiveBtn: css({
    marginRight: '1rem',
  }),
  field: css({
    label: 'field',
    flex: '0 1 auto',
    width: '100%',
    marginBottom: 0,
  }),
});
