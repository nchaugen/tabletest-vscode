public class SampleTableTest {

    @TableTest(
        """
        a | b
        1 | 22
        """
    )
    public void testSomething() {}
}

@interface TableTest {
    String value();
}
