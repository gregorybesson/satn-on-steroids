char  **ft_split(char *str, char *charset)
{
    int i;

    i = 0;
    while (str[i])
    {
        if (str[i] == charset[0])
        {
            return (ft_split(str + i + 1, charset));
        }
        i++;
    }
}

int main(int ac, char **av)
{
    char **res;

    if (ac == 3)
    {
        res = ft_split(av[1], av[2]);
        while (*res)
        {
            printf("%s\n", *res);
            res++;
        }
    }
    return (0);
}